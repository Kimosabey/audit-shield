from __future__ import annotations

import json
import os
import uuid
from typing import Any, AsyncIterator

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ChunkAuditRow, ChunkRow, DocumentRow, QueryRunRow
from app.ollama_client import (
    OLLAMA_EMBED_MODEL,
    OLLAMA_MODEL_AUDITOR,
    OLLAMA_BASE_URL,
    ollama_chat_json,
    ollama_embed,
    ollama_generate,
)
from app.schemas import Chunk, Citation, ModelRef, QueryRequest, QueryResponse, Step

AUDIT_TOP_K = int(os.getenv("AUDIT_TOP_K", "8"))
AUDIT_ADMIT_THRESHOLD = float(os.getenv("AUDIT_ADMIT_THRESHOLD", "0.62"))
AUDIT_MAX_CHUNK_CHARS = int(os.getenv("AUDIT_MAX_CHUNK_CHARS", "2000"))
DEFAULT_MODEL = os.getenv("AUDIT_DEFAULT_MODEL", "llama3.2")

DISCLAIMER = (
    "This output is assistive only; verify against source documents "
    "and your audit policy."
)


def _require_ollama() -> None:
    if not OLLAMA_BASE_URL:
        raise RuntimeError("OLLAMA_BASE_URL is required for embeddings, audit, and synthesis")


async def _chunk_count(session: AsyncSession) -> int:
    n = await session.scalar(select(func.count()).select_from(ChunkRow))
    return int(n or 0)


async def build_query_response(session: AsyncSession, body: QueryRequest) -> QueryResponse:
    _require_ollama()
    request_id = str(uuid.uuid4())
    synth_model = (body.model or "").strip() or DEFAULT_MODEL
    auditor_model = OLLAMA_MODEL_AUDITOR
    embed_model = OLLAMA_EMBED_MODEL

    steps: list[Step] = []

    n_chunks = await _chunk_count(session)
    if n_chunks == 0:
        steps.append(
            Step(
                name="Corpus check",
                detail="No indexed chunks in database — ingest documents via POST /v1/ingest/document.",
            )
        )
        return QueryResponse(
            request_id=request_id,
            answer=(
                "No documents are indexed yet. Upload and ingest content using "
                "`POST /v1/ingest/document` before running audited queries."
            ),
            citations=[],
            steps=steps,
            chunks=[],
            models=[
                ModelRef(role="auditor", name=auditor_model),
                ModelRef(role="synthesis", name=synth_model),
            ],
            disclaimer=DISCLAIMER,
        )

    qvec = await ollama_embed(body.query.strip(), embed_model)
    if not qvec:
        steps.append(Step(name="Embed query", detail="Failed to obtain query embedding from Ollama."))
        raise RuntimeError("Embedding failed — check OLLAMA_BASE_URL and OLLAMA_EMBED_MODEL")

    steps.append(
        Step(
            name="Embed query",
            detail=f"Derived {len(qvec)}-d vector via `{embed_model}`.",
        )
    )

    dist_expr = ChunkRow.embedding.cosine_distance(qvec)
    stmt = select(ChunkRow, dist_expr.label("dist")).order_by(dist_expr).limit(AUDIT_TOP_K)
    res = await session.execute(stmt)
    fetched = res.all()
    if not fetched:
        steps.append(Step(name="Vector retrieval", detail="No chunks returned (unexpected empty index)."))
        return QueryResponse(
            request_id=request_id,
            answer="The index is empty or retrieval returned no rows.",
            citations=[],
            steps=steps,
            chunks=[],
            models=[
                ModelRef(role="auditor", name=auditor_model),
                ModelRef(role="synthesis", name=synth_model),
            ],
            disclaimer=DISCLAIMER,
        )

    retrieval_pairs: list[tuple[ChunkRow, float]] = [(row[0], float(row[1])) for row in fetched]
    doc_ids = {ch.document_id for ch, _ in retrieval_pairs}
    doc_res = await session.execute(select(DocumentRow).where(DocumentRow.id.in_(doc_ids)))
    doc_map = {d.id: d for d in doc_res.scalars()}

    steps.append(
        Step(
            name="Vector retrieval",
            detail=f"Selected top-{len(retrieval_pairs)} chunks by cosine distance from pgvector.",
        )
    )

    chunk_lines = []
    for ch, dist in retrieval_pairs:
        sim = max(0.0, 1.0 - dist)
        snippet = ch.text[:AUDIT_MAX_CHUNK_CHARS]
        chunk_lines.append(
            f"- chunk_id: {ch.id}\n  source: {ch.source_label or 'unknown'}\n"
            f"  retrieval_similarity: {sim:.4f}\n  text: {snippet}"
        )

    auditor_system = (
        "You are an audit gate for industrial/compliance RAG. For each chunk, output ONE JSON object "
        "in an array. Fields: chunk_id (string UUID exactly as given), score (number 0-1 for relevance "
        "and appropriateness for the user question), admitted (boolean — true only if clearly relevant "
        "and safe to cite). Output ONLY a JSON array, no markdown."
    )
    auditor_user = (
        f"User question:\n{body.query.strip()}\n\nChunks:\n"
        + "\n".join(chunk_lines)
        + "\n\nRespond with JSON array only."
    )

    parsed = await ollama_chat_json(auditor_system, auditor_user, auditor_model)
    raw_auditor = json.dumps(parsed)[:8000] if isinstance(parsed, list) else ""
    decisions: dict[str, dict[str, Any]] = {}
    if isinstance(parsed, list):
        for item in parsed:
            if not isinstance(item, dict):
                continue
            cid = str(item.get("chunk_id", "")).strip()
            if not cid:
                continue
            try:
                sc = float(item.get("score", 0))
            except (TypeError, ValueError):
                sc = 0.0
            decisions[cid] = {
                "score": sc,
                "admitted": bool(item.get("admitted", False)),
            }
    else:
        steps.append(
            Step(
                name="Auditor scoring",
                detail="Auditor did not return valid JSON; treating all chunks as not admitted.",
            )
        )

    if isinstance(parsed, list):
        steps.append(
            Step(
                name="Auditor scoring",
                detail=f"Model `{auditor_model}` graded {len(retrieval_pairs)} chunks.",
            )
        )

    out_chunks: list[Chunk] = []
    admitted_rows: list[ChunkRow] = []
    audit_rows_payload: list[tuple[ChunkRow, float, float | None, bool]] = []

    for ch, dist in retrieval_pairs:
        sim = max(0.0, 1.0 - dist)
        cid = str(ch.id)
        d = decisions.get(cid, {})
        a_score: float | None = float(d["score"]) if d else None
        aud_yes = bool(d.get("admitted", False)) if d else False
        final_admit = bool(
            aud_yes
            and a_score is not None
            and a_score >= AUDIT_ADMIT_THRESHOLD
        )

        doc = doc_map.get(ch.document_id)
        doc_title = (doc.title if doc else "") or ""
        src = ch.source_label or doc_title or "document"

        display_score = a_score if a_score is not None else sim
        out_chunks.append(
            Chunk(
                id=cid,
                text=ch.text[:AUDIT_MAX_CHUNK_CHARS]
                + ("…" if len(ch.text) > AUDIT_MAX_CHUNK_CHARS else ""),
                score=display_score,
                admitted=final_admit,
                source=src,
            )
        )
        if final_admit:
            admitted_rows.append(ch)
        audit_rows_payload.append((ch, sim, a_score, final_admit))

    citations = []
    for ch in admitted_rows[:8]:
        doc = doc_map.get(ch.document_id)
        src = ch.source_label or (doc.title if doc else "") or "document"
        citations.append(Citation(source=src, chunk_id=str(ch.id)))

    if admitted_rows:
        parts = [
            f"- {c.id}: {(c.text[:600] + ('…' if len(c.text) > 600 else ''))}" for c in admitted_rows
        ]
        synth_prompt = (
            "You are an audit assistant. Answer concisely using ONLY the admitted chunks. "
            "Do not claim legal compliance. Cite chunk IDs in parentheses where helpful.\n\n"
            f"Question:\n{body.query.strip()}\n\nAdmitted chunks:\n"
            + "\n".join(parts)
        )
    else:
        synth_prompt = (
            "You are an audit assistant. No chunks were admitted after audit. Reply in 2 short sentences: "
            "state that there are no admitted passages and suggest refining the question or ingesting more documents. "
            f"Question was:\n{body.query.strip()}"
        )

    answer = await ollama_generate(synth_prompt, synth_model, temperature=body.temperature)
    if not answer:
        answer = (
            "Synthesis model did not return text — check Ollama and model availability."
            if admitted_rows
            else "No passages were admitted for this question; refine the query or broaden the knowledge base."
        )

    steps.append(
        Step(
            name="Synthesis",
            detail=f"Drafted answer with `{synth_model}`.",
        )
    )

    run_row = QueryRunRow(
        request_id=request_id,
        query_text=body.query.strip(),
        synthesize_model=synth_model,
        auditor_model=auditor_model,
        embed_model=embed_model,
    )
    session.add(run_row)
    try:
        await session.flush()

        for rank, (ch, sim, a_score, final_admit) in enumerate(audit_rows_payload):
            session.add(
                ChunkAuditRow(
                    run_id=run_row.id,
                    chunk_id=ch.id,
                    retrieval_score=sim,
                    auditor_score=a_score,
                    admitted=final_admit,
                    auditor_raw=raw_auditor if rank == 0 else None,
                    rank=rank,
                )
            )

        await session.commit()
    except Exception:
        await session.rollback()
        raise

    return QueryResponse(
        request_id=request_id,
        answer=answer,
        citations=citations,
        steps=steps,
        chunks=out_chunks,
        models=[
            ModelRef(role="auditor", name=auditor_model),
            ModelRef(role="synthesis", name=synth_model),
        ],
        disclaimer=DISCLAIMER,
    )


async def iter_audit_stream(
    session: AsyncSession, body: QueryRequest
) -> AsyncIterator[dict[str, Any]]:
    try:
        resp = await build_query_response(session, body)
    except RuntimeError as e:
        yield {"event": "error", "detail": str(e)}
        yield {"event": "done", "result": None}
        return

    yield {"event": "start", "request_id": resp.request_id}
    for s in resp.steps:
        yield {"event": "step", "step": s.model_dump()}
    yield {"event": "token", "text": resp.answer}
    yield {"event": "done", "result": resp.model_dump()}
