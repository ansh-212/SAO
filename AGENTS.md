# Agents Guide — InterviewVault

This repository is governed by:

1. **Product spec**: [`agent_instructions.md`](./agent_instructions.md) — full
   blueprint, feature roadmap, design language, AI routing, DB models, API
   surface, priorities. Always read before changing user-facing behavior.
2. **Cursor rules**: [`.cursor/rules/`](./.cursor/rules)
   - `01-product-spec.mdc` — spec is source of truth (always applied).
   - `02-frontend-conventions.mdc` — React + shadcn + Tailwind v4 + dark theme.
   - `03-backend-conventions.mdc` — FastAPI + SQLAlchemy + Gemini patterns.
   - `04-ai-usage.mdc` — when to use Gemini vs Perplexity (always applied).

## Repo layout
- `backend_final/` — FastAPI app. Entry: `main.py`. Routes in `routes/`,
  business logic in `services/`, models in `models.py`.
- `frontend_final/` — Vite + React 19 app. Pages in `src/pages/`, shadcn
  components in `src/components/ui/`, layout shells in `src/components/layout/`.
- `agent_instructions.md` — product blueprint (do not edit casually).

## Running locally
- Backend: `cd backend_final && python -m uvicorn main:app --reload --port 8000`
  (set `PYTHONUTF8=1` on Windows).
- Frontend: `cd frontend_final && npm run dev` → http://localhost:5173

## Environment
- `backend_final/.env`:
  - `SECRET_KEY` (required)
  - `GEMINI_API_KEY` (required for AI features)
  - `PERPLEXITY_API_KEY` (optional — falls back to Gemini-only company analysis)

## Working principles
- Frontend-first when shipping new flows; backend gaps are filled in lockstep
  so every UI is end-to-end functional.
- Reuse existing services/models before introducing new ones.
- All authenticated student pages live behind `OnboardingGate` so unfinished
  onboarding redirects to `/onboarding`.
