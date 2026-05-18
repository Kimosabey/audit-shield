from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

EMBED_DIM = 768  # nomic-embed-text


class DocumentRow(Base):
    __tablename__ = "document"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_uri: Mapped[str] = mapped_column(String(2048), default="")
    title: Mapped[str] = mapped_column(String(512), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    chunks: Mapped[list[ChunkRow]] = relationship(back_populates="document", cascade="all, delete-orphan")


class ChunkRow(Base):
    __tablename__ = "chunk"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("document.id", ondelete="CASCADE"), index=True
    )
    text: Mapped[str] = mapped_column(Text)
    source_label: Mapped[str] = mapped_column(String(512), default="")
    chunk_meta: Mapped[dict[str, Any] | None] = mapped_column("meta", JSONB, nullable=True)
    embedding: Mapped[list[float]] = mapped_column(Vector(EMBED_DIM))

    document: Mapped[DocumentRow] = relationship(back_populates="chunks")


class QueryRunRow(Base):
    __tablename__ = "query_run"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    request_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    query_text: Mapped[str] = mapped_column(Text)
    synthesize_model: Mapped[str] = mapped_column(String(256))
    auditor_model: Mapped[str] = mapped_column(String(256), default="")
    embed_model: Mapped[str] = mapped_column(String(256), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    audits: Mapped[list[ChunkAuditRow]] = relationship(
        back_populates="query_run", cascade="all, delete-orphan"
    )


class ChunkAuditRow(Base):
    __tablename__ = "chunk_audit"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("query_run.id", ondelete="CASCADE"), index=True
    )
    chunk_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), index=True)
    retrieval_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    auditor_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    admitted: Mapped[bool] = mapped_column(Boolean, default=False)
    auditor_raw: Mapped[str | None] = mapped_column(Text, nullable=True)
    rank: Mapped[int] = mapped_column(Integer, default=0)

    query_run: Mapped[QueryRunRow] = relationship(back_populates="audits")
