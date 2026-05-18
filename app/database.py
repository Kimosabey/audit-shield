from __future__ import annotations

import os
from collections.abc import AsyncIterator
from pathlib import Path

from dotenv import load_dotenv
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

# Repo root = parent of app/ — load .env before any os.getenv used by this module or importers.
# override=True: values in .env win over stale shell/user env (e.g. old OLLAMA_BASE_URL on Windows).
load_dotenv(Path(__file__).resolve().parent.parent / ".env", override=True)

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine():
    global _engine, _session_factory
    if not DATABASE_URL:
        return None
    if _engine is None:
        url = DATABASE_URL
        if url.startswith("postgresql://"):
            url = "postgresql+asyncpg://" + url[len("postgresql://") :]
        elif not url.startswith("postgresql+asyncpg://"):
            raise ValueError("DATABASE_URL must be postgresql:// or postgresql+asyncpg://")
        _engine = create_async_engine(url, pool_pre_ping=True)
        _session_factory = async_sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_session_factory():
    get_engine()
    return _session_factory


async def get_db() -> AsyncIterator[AsyncSession]:
    factory = get_session_factory()
    if factory is None:
        raise HTTPException(status_code=503, detail="DATABASE_URL is not configured")
    async with factory() as session:
        yield session


async def init_db_schema() -> None:
    """Create extension and tables (idempotent)."""
    import app.models  # noqa: F401 — register ORM mappers
    from sqlalchemy import text

    eng = get_engine()
    if eng is None:
        return
    async with eng.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
