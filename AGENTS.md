# Agent notes

- Treat FIN-SHIELD as an investigation aid, not a verdict engine.
- Do not describe the rules engine as a trained model.
- Do not fetch user-supplied URLs.
- Do not invent dashboard statistics; read them from the API.
- Seed data is synthetic. Keep that label in the UI.
- Prefer extending `app/services/*` over scattering scoring rules in routes.
- Repeatable seed: `python seed.py` from `backend/` (idempotent via `seed_key`).
