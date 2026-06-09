# AGENTS.md — Pixel Studio

Guidance for AI coding agents (Cursor, etc.) working in this repo.

## What this is
A multi-model AI **UI-component design studio**. Models generate self-contained HTML+Tailwind components; a **vision critic** (Claude) scores them from the *rendered screenshot*; rival models **battle** on a leaderboard.

- **CLI** (Node ESM, repo root): `build.mjs` (shared lib + single build), `studio.mjs` (critic loop), `battle.mjs` (model battle), `gallery.mjs`.
- **Web app**: `web/` — Next.js (App Router, Turbopack). Streams the build → render → critic loop live via SSE; has a Critic-loop tab and a cross-vendor Model-battle tab.

## Run
```bash
# CLI
npm install && npx playwright install chromium
node battle.mjs "a hero section for an AI startup"

# Web
cd web && npm install && npm run dev      # http://localhost:3000
```

## Conventions & rules
- **Type-check after web edits:** `cd web && npx tsc --noEmit` must pass (0 errors) before a change is "done".
- **Keys live in `web/.env.local`** (gitignored): `ANTHROPIC_API_KEY` (builder + vision critic), `GEMINI_API_KEY` (Gemini contestant), optional `GEMINI_MODEL`. Never hardcode or commit keys.
- **Keyless stub fallback** runs the whole pipeline without keys (deterministic templates + scores) — keep it working so the app runs offline.
- **Anthropic model IDs use dashes**: `claude-opus-4-8`, `claude-sonnet-4-6`, `claude-haiku-4-5`. The UI shows them dotted (`4.8`) via a display helper — do not change the real IDs.
- **Gemini** is called via the REST API directly (no SDK). 3.1 Pro is a *thinking* model → keep `maxOutputTokens` generous.
- **Never commit generated outputs** (`*.png`, `gallery.html`, `battle-*.html`, `leaderboard.*`, `studio-log.md`, …) — they're gitignored; regenerate by running the scripts.
- **iframe previews of AI-generated HTML must go through the `frame()` guard** in `web/app/page.tsx` (blocks link/form navigation that would hijack the frame to the host app; also hides scrollbars).

## Workflow
Planning, architecture, and code review happen in a separate Claude chat; implementation happens here via Cursor. Keep changes focused and explain what changed so it can be reviewed.
