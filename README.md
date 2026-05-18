# AuditShield

Corrective / audited RAG — fast model gates retrieved chunks before synthesis.

**GitHub:** [Kimosabey/audit-shield](https://github.com/Kimosabey/audit-shield)

`git clone git@github.com:Kimosabey/audit-shield.git` (uses your existing `~/.ssh/config` for GitHub)

**API port:** `8101`

## Run

**Docker:** `docker compose up --build` → [http://localhost:8101/health](http://localhost:8101/health)

**Local:** `python -m venv .venv` → activate → `pip install -r requirements.txt` → `uvicorn app.main:app --reload --host 0.0.0.0 --port 8101`

OpenAPI: [http://localhost:8101/docs](http://localhost:8101/docs)
