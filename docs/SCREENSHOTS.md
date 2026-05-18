# AuditShield — screenshots to capture

> Capture these into `docs/img/` as **PNG, 1600×1000 minimum, lossless**. Filenames
> are referenced from `README.md`. Until you record real ones, the README falls
> back to the SVG banner.

| File | What it shows | Where in the UI |
|------|---------------|-----------------|
| `docs/img/banner.svg`         | Themed brand banner (committed)        | — already generated |
| `docs/img/01-hero.png`        | Top hero with wax seal + lead headline | `/` initial load    |
| `docs/img/02-ingest.png`      | Ingest card with sample policy loaded  | After **Load sample policy** |
| `docs/img/03-query-form.png`  | Query card, example chips, model picker | Click an example chip |
| `docs/img/04-result-answer.png` | Result panel: answer + citations     | After a successful run |
| `docs/img/05-chunks-admit.png`  | Admitted / rejected chunk cards with scores | Same result, scroll |
| `docs/img/06-audit-trail.png`   | Audit trail table at the bottom      | After ≥2 runs       |
| `docs/img/07-reduced-motion.png` | Same screen with OS reduced-motion ON | Toggle OS setting   |

## How to record

```pwsh
# 1) Start the API and UI (run-dev.ps1 / npm run dev)
# 2) Browser at 1600×1000, zoom = 100%
# 3) Use the OS or browser snip tool — save as PNG into docs/img/
# 4) Optional WebP convert (smaller):
#    magick docs/img/01-hero.png -quality 92 docs/img/01-hero.webp
```

If you have no real corpus, the ingest card has a **Load sample policy** button
that populates with the sample text from `samples/`.
