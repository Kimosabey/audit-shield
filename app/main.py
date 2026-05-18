import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

SERVICE_SLUG = "audit-shield"
PORT = int(os.getenv("PORT", "8101"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "").rstrip("/")
DEFAULT_MODEL = os.getenv("AUDIT_DEFAULT_MODEL", "llama3.2")

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

_cors = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOW_ORIGINS = [o.strip() for o in _cors.split(",") if o.strip()]

app = FastAPI(
    title="AuditShield",
    description="Corrective / audited on-prem RAG (scaffold).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=50_000)
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0, le=2)


class Citation(BaseModel):
    source: str
    chunk_id: str


class Chunk(BaseModel):
    id: str
    text: str
    score: float
    admitted: bool
    source: str


class Step(BaseModel):
    name: str
    detail: str


class ModelRef(BaseModel):
    role: str
    name: str


class QueryResponse(BaseModel):
    request_id: str
    answer: str
    citations: list[Citation]
    steps: list[Step]
    chunks: list[Chunk]
    models: list[ModelRef]
    disclaimer: str = (
        "This output is assistive only; verify against source documents "
        "and your audit policy."
    )


def _stub_pipeline(query: str, request_id: str, synthesize_model: str) -> QueryResponse:
    q = query.strip()
    steps = [
        Step(name="Embed query", detail="Derived 768-d vector (stub)."),
        Step(
            name="Vector + keyword retrieval",
            detail="Matched 3 candidate chunks from policy index (stub).",
        ),
        Step(
            name="Auditor scoring",
            detail="Cross-encoder re-rank with admission threshold 0.62 (stub).",
        ),
        Step(
            name="Synthesis",
            detail=f"Drafted answer with {synthesize_model} (temperature applied).",
        ),
    ]
    chunks = [
        Chunk(
            id="CHK-001",
            text=(
                f"[Stub] Chunk discussing related requirements for: {q[:120]}"
                + ("…" if len(q) > 120 else "")
            ),
            score=0.81,
            admitted=True,
            source="policy_master_v3.pdf · §4.2",
        ),
        Chunk(
            id="CHK-002",
            text="[Stub] Secondary clause on record retention and traceability IDs.",
            score=0.58,
            admitted=False,
            source="runbook_Q4.pdf · p.12",
        ),
        Chunk(
            id="CHK-003",
            text="[Stub] Table row for part families and warranty exclusions.",
            score=0.74,
            admitted=True,
            source="warranty_matrix.xlsx · Sheet2",
        ),
    ]
    admitted = [c for c in chunks if c.admitted]
    citations = [
        Citation(source=c.source, chunk_id=c.id) for c in admitted[:2]
    ]
    answer = (
        f"[Stub] Based on admitted chunks, the policy narrative for your question "
        f"centers on traceable records and cited sections. Request `{request_id}` — "
        "confirm against primary sources before sign-off."
    )
    models = [
        ModelRef(role="auditor", name="cross-encoder-stub"),
        ModelRef(role="synthesis", name=synthesize_model),
    ]
    return QueryResponse(
        request_id=request_id,
        answer=answer,
        citations=citations,
        steps=steps,
        chunks=chunks,
        models=models,
    )


async def _ollama_generate(prompt: str, model: str) -> str | None:
    if not OLLAMA_BASE_URL:
        return None
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{OLLAMA_BASE_URL}/api/generate",
                json={
                    "model": model,
                    "prompt": prompt,
                    "stream": False,
                },
            )
            r.raise_for_status()
            data = r.json()
            return str(data.get("response", "")).strip() or None
    except (httpx.HTTPError, ValueError):
        return None


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE_SLUG, "port": PORT}


@app.post("/v1/query", response_model=QueryResponse)
async def query_v1(body: QueryRequest) -> QueryResponse:
    request_id = str(uuid.uuid4())
    model = (body.model or "").strip() or DEFAULT_MODEL
    stub = _stub_pipeline(body.query, request_id, model)

    if OLLAMA_BASE_URL:
        prompt = (
            "You are an audit assistant. Answer concisely. "
            "Do not claim legal compliance. Cite chunk IDs when possible.\n\n"
            f"Question:\n{body.query}\n\n"
            "Admitted chunk summaries:\n"
            + "\n".join(f"- {c.id}: {c.text[:200]}" for c in stub.chunks if c.admitted)
        )
        llm_answer = await _ollama_generate(prompt, model)
        if llm_answer:
            stub = stub.model_copy(update={"answer": llm_answer})

    return stub


@app.post("/v1/query/stream")
async def query_stream(body: QueryRequest) -> StreamingResponse:
    """Optional SSE: step events then a final `done` payload matching QueryResponse."""

    async def gen():
        request_id = str(uuid.uuid4())
        model = (body.model or "").strip() or DEFAULT_MODEL
        stub = _stub_pipeline(body.query, request_id, model)

        yield _sse({"event": "start", "request_id": request_id})
        for s in stub.steps:
            yield _sse({"event": "step", "step": s.model_dump()})
            await asyncio.sleep(0.02)

        if OLLAMA_BASE_URL:
            prompt = (
                "You are an audit assistant. One short paragraph. "
                "No guarantees of compliance.\n\n"
                f"Question:\n{body.query}"
            )
            llm_answer = await _ollama_generate(prompt, model)
            if llm_answer:
                yield _sse({"event": "token", "text": llm_answer})
                stub = stub.model_copy(update={"answer": llm_answer})

        yield _sse({"event": "done", "result": stub.model_dump()})

    return StreamingResponse(gen(), media_type="text/event-stream")


if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="spa")
else:

    @app.get("/")
    def root() -> dict:
        return {
            "service": SERVICE_SLUG,
            "docs": "/docs",
            "health": "/health",
            "ui": "(dev: run Vite on :5173 or build web to ./static)",
        }
