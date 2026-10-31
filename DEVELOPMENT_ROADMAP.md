# FIN-SHIELD development roadmap

## Completed in this MVP

- Modular FastAPI backend with SQLite persistence
- Deterministic extraction and risk services
- Exact entity matching plus TF-IDF cosine similarity
- Campaign clusters as connected components
- Investigation workflow, notes, and alerts
- React investigation console
- Synthetic seed dataset (~100 advertisements)
- Backend pytest coverage for core analysis behavior

## Later, without rewriting the app

- Replace the rules engine with a trained classifier behind `app/services/risk.py`
- Replace TF-IDF with embeddings behind `app/services/similarity.py`
- Optional secured URL inspection separate from string parsing
- PostgreSQL via `DATABASE_URL`
- Stronger OCR once Tesseract is installed locally
- Authentication and role-based review queues
