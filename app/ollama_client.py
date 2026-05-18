from __future__ import annotations

import json
import os
from typing import Any

import httpx

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "").rstrip("/")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
OLLAMA_MODEL_AUDITOR = os.getenv("OLLAMA_MODEL_AUDITOR", "phi:latest")


async def ollama_embed(text: str, model: str | None = None) -> list[float] | None:
    if not OLLAMA_BASE_URL:
        return None
    m = model or OLLAMA_EMBED_MODEL
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{OLLAMA_BASE_URL}/api/embeddings",
                json={"model": m, "prompt": text},
            )
            r.raise_for_status()
            emb = r.json().get("embedding")
            if isinstance(emb, list) and all(isinstance(x, (int, float)) for x in emb):
                return [float(x) for x in emb]
            return None
    except (httpx.HTTPError, ValueError, TypeError):
        return None


async def ollama_embedding_failure_hint(model: str) -> str:
    """Short human-readable reason when every chunk embedding failed."""
    if not OLLAMA_BASE_URL:
        return "OLLAMA_BASE_URL is not set."
    url = f"{OLLAMA_BASE_URL}/api/embeddings"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.post(url, json={"model": model, "prompt": "."})
            if r.status_code == 200:
                return (
                    "Ollama accepted a probe embed but all document chunks failed — "
                    "check server logs and chunk content length."
                )
            if r.status_code == 404:
                return f"Model {model!r} not found — run: ollama pull {model}"
            snippet = (r.text or "").strip().replace("\n", " ")[:240]
            return f"POST /api/embeddings returned HTTP {r.status_code}.{(' ' + snippet) if snippet else ''}"
    except httpx.ConnectError:
        return f"Cannot connect to Ollama at {OLLAMA_BASE_URL} (is it running?)"
    except httpx.TimeoutException:
        return f"Ollama at {OLLAMA_BASE_URL} timed out."
    except httpx.HTTPError as e:
        return str(e) or "HTTP error calling Ollama embeddings."


async def ollama_generate(
    prompt: str,
    model: str,
    *,
    temperature: float | None = None,
) -> str | None:
    if not OLLAMA_BASE_URL:
        return None
    payload: dict[str, Any] = {"model": model, "prompt": prompt, "stream": False}
    if temperature is not None:
        payload["options"] = {"temperature": temperature}
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json=payload,
            )
            r.raise_for_status()
            return str(r.json().get("response", "")).strip() or None
    except (httpx.HTTPError, ValueError):
        return None


async def ollama_chat_json(system: str, user: str, model: str) -> dict[str, Any] | list[Any] | None:
    """Ask Ollama /api/chat for JSON content; parse first JSON object/array from message."""
    if not OLLAMA_BASE_URL:
        return None
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "stream": False,
                },
            )
            r.raise_for_status()
            data = r.json()
            msg = (data.get("message") or {}).get("content") or ""
            if not isinstance(msg, str):
                return None
            msg = msg.strip()
            # strip markdown fences
            if msg.startswith("```"):
                msg = msg.split("\n", 1)[-1]
                if "```" in msg:
                    msg = msg.rsplit("```", 1)[0]
            msg = msg.strip()
            return json.loads(msg)
    except (httpx.HTTPError, ValueError, json.JSONDecodeError, TypeError):
        return None
