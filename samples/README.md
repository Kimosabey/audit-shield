# Sample documents for ingest / upload tests

| File | Use |
|------|-----|
| `policy-warranty-sample.txt` | Rich plain text matching the UI example queries (WDG-4401, LOTO, PRV-03, retention, MB-2024-07 vs SOP-HVAC-114). |

**Manual upload:** In the AuditShield UI, choose this file in **PDF or plain text file** (`.txt` is supported).

**Dev UI:** On `npm run dev`, use **Load sample text** in the ingest card; it pulls the same content from `/samples/policy-warranty-sample.txt`.

**API offline (`ECONNREFUSED 8101`):** From `audit-shield`, run `.\run-dev.ps1` in one terminal, then `cd web` + `npm run dev` in another — or use `.\run-all-dev.ps1` to open both.
