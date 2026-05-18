import os

from fastapi import FastAPI

SERVICE_SLUG = "audit-shield"
PORT = int(os.getenv("PORT", "8101"))

app = FastAPI(
    title="AuditShield",
    description="Corrective / audited on-prem RAG (scaffold).",
    version="0.1.0",
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": SERVICE_SLUG, "port": PORT}


@app.get("/")
def root() -> dict:
    return {
        "service": SERVICE_SLUG,
        "docs": "/docs",
        "health": "/health",
    }
