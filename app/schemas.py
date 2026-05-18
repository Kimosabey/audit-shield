from pydantic import BaseModel, Field


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
