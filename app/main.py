from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict, Field
from pydantic import model_validator
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import DATABASE_URL, get_db, get_session_factory, init_db_schema
from app.models import ChunkRow, DocumentRow
from app.ollama_client import (
    OLLAMA_BASE_URL,
    OLLAMA_EMBED_MODEL,
    ollama_embed,
    ollama_embedding_failure_hint,
)
from app.pdf_extract import extract_pdf_text
from app.pipeline import build_query_response, iter_audit_stream
from app.schemas import QueryRequest, QueryResponse
from app.text_chunking import chunk_text, normalize_ingest_text

SERVICE_SLUG = "audit-shield"
PORT = int(os.getenv("PORT", "8101"))

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

_cors = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173")
ALLOW_ORIGINS = [o.strip() for o in _cors.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    if DATABASE_URL:
        try:
            await init_db_schema()
        except Exception as e:
            raise RuntimeError(f"Database init failed: {e}") from e
    yield


app = FastAPI(
    title="AuditShield",
    description="Corrective / audited on-prem RAG with pgvector + Ollama.",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestTextBody(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="ignore")

    text: str = Field(min_length=1, max_length=5_000_000)
    title: str = Field(default="", max_length=512)
    source_uri: str = Field(default="", max_length=2048)

    @model_validator(mode="before")
    @classmethod
    def _coerce_source_uri_alias(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data
        if "source_uri" not in data and "sourceUri" in data:
            return {**data, "source_uri": data.get("sourceUri", "")}
        return data


def _sse(data: dict[str, Any]) -> str:
    return f"data: {json.dumps(data)}\n\n"


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "service": SERVICE_SLUG,
        "port": PORT,
        "database_configured": bool(DATABASE_URL),
    }


async def _ingest_plain_text(
    session: AsyncSession,
    text: str,
    title: str,
    source_uri: str,
) -> dict[str, Any]:
    if not DATABASE_URL:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured")
    pieces = chunk_text(text)
    if not pieces:
        raise HTTPException(
            status_code=400,
            detail=(
                "No indexable text in this content (empty or only whitespace/format characters after cleanup). "
                "For PDFs, use text-based files, not image-only scans."
            ),
        )
    doc = DocumentRow(
        title=title or "Untitled",
        source_uri=source_uri or "inline",
    )
    session.add(doc)
    await session.flush()

    n_ok = 0
    for piece in pieces:
        emb = await ollama_embed(piece, OLLAMA_EMBED_MODEL)
        if not emb:
            continue
        session.add(
            ChunkRow(
                document_id=doc.id,
                text=piece,
                source_label=doc.title,
                embedding=emb,
            )
        )
        n_ok += 1
    if n_ok == 0:
        await session.rollback()
        hint = await ollama_embedding_failure_hint(OLLAMA_EMBED_MODEL)
        raise HTTPException(
            status_code=502,
            detail=(
                "Embedding failed for all chunks. "
                f"{hint} (embed model: {OLLAMA_EMBED_MODEL!r}, OLLAMA_BASE_URL: {OLLAMA_BASE_URL or '(unset)'})"
            ),
        )
    await session.commit()
    return {"document_id": str(doc.id), "chunks_indexed": n_ok, "title": doc.title}


@app.post("/v1/ingest/document")
async def ingest_document_json(
    body: IngestTextBody,
    session: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    return await _ingest_plain_text(
        session,
        body.text,
        body.title,
        body.source_uri,
    )


@app.post("/v1/ingest/upload")
async def ingest_upload(
    session: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
    title: str | None = Form(None),
    source_uri: str | None = Form(None),
) -> dict[str, Any]:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")
    ct = (file.content_type or "").lower()
    fname = file.filename or "upload"
    text_content: str
    looks_pdf = (
        ct == "application/pdf"
        or fname.lower().endswith(".pdf")
        or raw[:5] == b"%PDF-"
        or (len(raw) >= 4 and raw[:4] == b"%PDF")
    )
    if looks_pdf:
        try:
            text_content = extract_pdf_text(raw)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"PDF read failed: {e}") from e
    else:
        try:
            text_content = raw.decode("utf-8")
        except UnicodeDecodeError:
            text_content = raw.decode("latin-1", errors="replace")

    text_content = normalize_ingest_text(text_content)
    if not text_content:
        raise HTTPException(
            status_code=400,
            detail=(
                "No extractable text from this file. For PDFs, try text-based PDFs (not image-only scans); "
                "for .txt, ensure UTF-8 or non-empty content."
            ),
        )

    t = (title or "").strip() or fname
    su = (source_uri or "").strip() or fname
    return await _ingest_plain_text(session, text_content, t, su)


@app.post("/v1/query", response_model=QueryResponse)
async def query_v1(
    body: QueryRequest,
    session: AsyncSession = Depends(get_db),
) -> QueryResponse:
    try:
        return await build_query_response(session, body)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


@app.post("/v1/query/stream")
async def query_stream(body: QueryRequest) -> StreamingResponse:
    async def gen():
        factory = get_session_factory()
        if factory is None:
            yield _sse({"event": "error", "detail": "DATABASE_URL is not configured"})
            yield _sse({"event": "done", "result": None})
            return
        async with factory() as session:
            async for payload in iter_audit_stream(session, body):
                yield _sse(payload)

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
            "ingest": "/v1/ingest/document",
            "ui": "(dev: run Vite on :5173 or build web to ./static)",
        }
