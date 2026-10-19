# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Operational Guidance

- Use extremely concise language in all interactions. British English spellings. Sacrifice grammar for concision.
- Your human pair is a highly experienced full-stack developer; no nicknames. He runs the system on a local dev server with HMR and tests your changes himself — lint, build and test your work before handing over.
- Always prioritise code quality, maintainability, and performance.
- Omit meaningless time & effort estimates from all plans.
- Apart from useful examples or data/type structures, plans shouldn't include code.
- NEVER hand-verify UI behaviour with ad-hoc browser driving. Behavioural coverage lives in the Playwright E2E suite (`e2e/`) — extend it instead. Every user-facing control must deliver the outcome its label promises, and the test asserts that outcome, not that machinery ran.
- Verification against live data is forbidden. E2E runs hermetically on its own temp database; anything manual uses a scratch story, never the user's stories.

## Engineering SOPs (distilled from the v2 build's failures)

Each rule below exists because its absence shipped a real defect. Do not relax them.

1. **Journey-first.** Define the writer-visible outcome before building, and land the E2E journey in the same commit as the feature. A control's label is a promise; "it navigated" is not "it added". (The "Add to bible" chip navigated and did nothing.)
2. **Deletions require a parity audit.** Before removing user-facing code, enumerate its capabilities FROM THE CODE BEING DELETED — not from memory — and disposition each: kept / replaced by X / deliberately dropped (recorded). (The cutover silently lost series membership, manual bible CRUD, language editing, chapter metadata, reorder, JSON export, brainstorm regenerate.)
3. **Unprimed review first.** Adversarial reviews run in two lanes: first unprimed (repo + product claim + user perspective, no category lists, no suspect files — the author's framing steers reviewers into the author's blind spots), then primed technical review. Never primed-only. (Unprimed runs found whole classes — lossy backups, destructive conflict recovery, unreadable reader — that steered reviews missed.)
4. **No silent failure.** Every catch/fallback either surfaces to the writer, is a designed bounded retry, or carries a comment justifying silence. "Error" and "empty" are different UI states. (Zero-token streams reported "complete"; server outages rendered as "No stories yet"; truncated model JSON toasted "Nothing extractable found".)
5. **Written state must name its reader.** Persisted state nothing consumes is decorative — grep for the consumer before calling the feature done. Writes bypassing the canonical store must sync it. (The POV picker persisted state generation never sent; raw-fetch saves bypassed the query cache and manufactured 409s.)
6. **Unknowns default loud or generous, never silently small.** Provider/model metadata (context windows, token budgets) that can't be known must fail visibly or default high — undershooting silently amputates the writer's context. (gpt-5 was budgeted at 4,096 tokens.)
7. **Discoverability is part of existence.** A capability the writer can't find from the place the need arises is missing. Wire entry points at the point of need (nudge chip → extraction; brainstorm reply → chapter/bible). (Story voice existed while the user hunted for a British-English setting.)
8. **Multiplier check.** When a change multiplies entities — import creating fifty chapters — sweep every per-entity flow for a batch path before shipping. (Whole-story extraction was only built after the user hit per-chapter tedium.)
9. **Docs are change surface.** Grep README/docs/guide for claims touched by any change; a stale claim is a defect and a dangerous one (backup instructions) is a serious defect. The in-app guide counts.
10. **Curate, don't just implement.** After each feature, ask what journey it completes and what adjacent dead-end it exposes; propose the follow-on rather than waiting for the user to trip over it. Keep the task list honest about product gaps, not just build steps.
11. **Problem reports are UX reports first.** When the writer says something went wrong, the first question is _what did the app show them, and was that good enough?_, not _whose fault is it?_ Something outside the app misbehaving (model server, network, provider) explains the cause; it never excuses a silent, slow or vague experience. Lead the answer with the app's failure and the fix; put the environment's part second, as context. (A model-server swap produced a two-minute silent spinner, and the first response was a diagnosis of the server.)
12. **Nothing that calls a model or API is free.** Every automatic call (background, retry, re-arm, on-open) needs a trigger that means real work is due, a once-per-cause guard, and a hard rate cap — and an E2E test proving idle time, reading and trivial edits cost nothing. "Changed" is decided semantically (parsed structures, meaningful thresholds), never by comparing serialised strings. (Background summaries re-ran on every chapter visit and retried a deterministic failure; a revision bumped per keystroke burst made them due.)

## Project Overview

Repo: https://github.com/jonsilver/TheStoryNexus

The Story Nexus is a local-first web application for AI-assisted creative writing, built with Express.js, React, TypeScript, and SQLite. Writers write in a Lexical-based editor with AI woven in — scene beats, inline continuations, selection actions, a story bible with AI extraction, brainstorming — while all data stays on their own machine. Run locally or deploy via Docker for LAN access (trusted network, no auth).

## Development Commands

```bash
npm run dev          # Backend (3001) + frontend (5173, Vite proxy to backend)
npm run dev:server   # Backend only (Express + SQLite)
npm run dev:client   # Frontend only (Vite)
npm run lint         # OxLint
npm run lint:fix     # Fix linting issues
npm run format       # Prettier (whole repo)
npm test             # Vitest unit tests
npm run test:e2e     # Playwright journey tests (hermetic: own DB, mocked AI)
npm run verify       # lint + tsc (client & server) + unit + e2e — the full gate
npm run knip         # Dead code/dependency detection — run after refactors
npm run build        # Production build (server + client)
npm start            # Production server (port 3000, PORT env)
npm run db:generate  # Drizzle migration from schema changes
npm run db:migrate   # Apply migrations
```

Production serves the built client from `dist/` on a single port. Docker: `docker-compose up --build` (port 3000).

## Binding Documents

- `docs/v2-contracts.md` — the binding spec: document model, scene-beat lifecycle (takes), export mapping, action registry, generation API, lorebook matching, revisions/saves/summary freshness, token budgeting. Changes require a documented decision. Read it before touching the editor, actions, or export.

## Architecture

### Stack

**Backend**: Express v5, better-sqlite3 + Drizzle ORM, Zod validation, Multer uploads. ALL AI provider access is server-side (`server/services/ai/providers.ts`): OpenAI, Gemini, OpenRouter, Local (Ollama/LM Studio OpenAI-compatible). Keys never reach the client.

**Frontend**: React 18, Vite, React Router v7, TanStack Query v5, Lexical (lean purpose-built composition in `src/v2/editor/` — NOT the playground), Tailwind + Shadcn UI, react-toastify.

### Routing

The URL is the source of truth for where the writer is (`src/v2/routing.tsx`, #81). `main.tsx` hands every path to `V2App`, which owns the routes:

```
/                                   — resume: last story's Write screen (localStorage remembers only this)
/write, /story, /brainstorm         — the same screens with no story chosen (empty states)
/story/:storyId                     — Story hub
/story/:storyId/write/:chapterId?   — Write (URL chapter wins; missing/unknown → corrected in place)
/story/:storyId/chapters|bible|notes|read
/story/:storyId/brainstorm/:chatId? — Brainstorm, with the open chat
/library
/settings, /settings/actions, /settings/providers, /settings/series, /guide
legacy: /v2, /stories, /stories/:id/read, /series/*, /?tool=… redirect; anything else → /
```

- Screens navigate with `goTo(tool)` (pushes a real history entry; the story comes from the URL, else the store, read at call time) and back arrows with `goBack(fallback)` (history-back when the writer arrived from inside the app, else the fallback screen — back must never leave the app).
- `StoryScope` provides `RouteParamsContext` (story/chapter/chat ids) and shows a plain "story doesn't exist" screen for unknown ids. `useV2Store().currentStoryId` returns the URL's story inside a story route.
- Full pages (AI settings, Series, Guide) render inside `EmbeddedPage`, which supplies the only back control — embedded pages must never add their own navigation.
- Production Express serves the app for every non-API path; unknown `/api/*` paths are JSON 404s.

### Frontend layout

- `src/v2/` — the app. `V2App.tsx` shell; `screens/` (Write, Chapters, Stories, Bible, Brainstorm, Notes, Actions, More, Import, Export); `editor/` (Lexical composition, nodes, plugins, saver, auto-summarise); `ai/` (streamAction SSE client, useActionGeneration, ActionSheet, editor actions, ContextInspector); `bible/` (extraction flows, name nudges); `export/` (document JSON → blocks → md/html/txt renderers + undecided-draft detection); `drawer/` (action override editor); `state/useV2Store.ts` (localStorage UI state).
- `src/features/*/hooks/` — TanStack Query hooks per domain (stories, chapters, lorebook, notes, brainstorm, series, ai settings). Legacy v1 feature components are gone; the survivors outside hooks are the pages the shell embeds (AI settings, series list, guide).
- `src/services/api/` — fetch client; `src/services/ai/AIService.ts` — settings facade ONLY (generation goes through v2 streamAction).

### Server layout

- `server/routes/` — stories, chapters, series, lorebook, notes, brainstorm, ai (settings/keys/models), actions (override CRUD), generate (SSE generation + preview + abort), ingest (manuscript import), assets, admin (export/import/backup/demo).
- `server/services/actions/` — the action registry (`registry.ts`: built-in actions + templates), context assembly (`context.ts`: token-budgeted), override resolution (`resolve.ts`: story → global → built-in, invalid values fall through).
- `server/services/ingest/` — txt/md/docx/epub parsing, chapter splitting, Lexical conversion (streaming zip-bomb guards).
- `server/db/` — Drizzle schema, migrations, demo-story seeding.

### Key mechanisms (details in docs/v2-contracts.md)

- **Actions, not prompts**: built-in actions (scene_beat, continue, rework, expand, shorten, ask, summarise_chapter, brainstorm, extract_entries, propose_updates, check_continuity) with per-action overrides (model, samplers, template) stored in `actionOverrides`. Per-story voice (`stories.aiInstructions`) appended to prose actions.
- **Generation**: client posts `{requestId, actionId, storyId, chapterId, editorContext}` → server assembles context (lorebook matching, summaries, budgeting) → SSE `status/token/finish/error/aborted`. A provider-agnostic runner (`generationRun.ts`) narrates phases (waiting / thinking / streaming) with per-phase timeouts and writer-readable errors naming model and server; no hidden SDK retries. Zero-content streams are errors. `/api/generate/preview` returns the resolved prompt (the "What gets sent" inspector).
- **Scene beats** live IN the document (`scene-beat-v2` NodeState): multi-take model — no generation is ever lost; streaming goes to a durable `streaming` field (history-merge tagged) and commits as a take. Orphaned streams recover as takes on mount.
- **Try again, never lose an attempt**: action sheets (rework/expand/shorten/ask/summarise) keep every result as an attempt (`useAttempts`, ‹ n of m ›; accept uses the one shown); ghost Continue keeps runtime attempts and a failed ghost stays with Try again; brainstorm Regenerate keeps earlier replies as `versions` on the message; failures everywhere offer Try again in place and keep earlier results.
- **Ghost continuations** (`suggestion-v2`): inline greyed prose, Keep/Refine/Dismiss; a runtime-only freshness marker prevents rehydrated ghosts from auto-firing generations.
- **Selection context menu**: right-click / Android long-press on selected text opens the app's menu (rework/expand/shorten/ask + formatting). iOS Safari doesn't fire contextmenu on long-press — the toolbar selection buttons are the touch path there.
- **Series**: joined from Story → Details, series & voice; the library groups stories by series; series-level bible entries flow into member stories' AI context automatically.
- **Brainstorm bridges**: replies can become notes, bible entries (auto-run extraction), or new chapters (reply lands as the chapter outline). Chapter POV/outline/summary edit via the Chapters screen details sheet.
- **Saves**: `saveVersion`-aware (expectedSaveVersion → 409 conflict banner with draft download; editor locks). Documents are compared structurally, never as serialised strings; an identical save writes nothing. `revision` moves only on significant prose change (`server/lib/proseChange.ts`) and drives summary freshness. Cross-module save flushing (`flushChapterSave`) before chapter-based AI actions and exports. All chapter writes sync the TanStack caches (`applyChapterToCaches`, revision-monotonic).
- **Auto-summarise**: only after a significant change made in this sitting + 90s idle; once per revision (no retry loop), ≤6/hour per browser, skips writer-locked summaries, never on merely opening a chapter; toggleable in Settings; failures raise a persistent warning.
- **Exports**: document JSON → block list → per-target renderers; scene beats/ghosts omitted (with an undecided-drafts warning); EPUB server-side. Backup via SQLite online backup API (`/api/admin/backup`) — never bare .db copies (WAL).

### Testing

- Unit: Vitest, colocated `*.test.ts`. Server logic (registry/resolve/context/ingest/providers) and pure client modules (export, nameNudges, parseProposals, crypto).
- E2E: `e2e/writer-journeys.spec.ts` + `e2e/helpers.ts`. Hermetic per run (temp SQLite, own ports, `mockGeneration` intercepts `/api/generate/action` with SSE fixtures). Journeys assert writer-visible outcomes. Add a journey when adding any user-facing flow.

### Code Quality & Style

- OxLint + Prettier. TypeScript `strict: false` but `noImplicitAny`, `strictNullChecks`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` enabled.
- Error handling: only where recoverable; functional style with `@jfdi/attempt` (`const [error, result] = await attemptPromise(...)`).
- Functional patterns; `const` not `let`; arrow functions; async/await; no explicit `any`; no classes except genuinely stateful resources; data-driven type-inference over switch/if-chains; factory/higher-order functions over boilerplate; custom hooks over in-component multi-hook logic; no `useEffect` for derived state.
- Comments extremely sparingly — only for constraints the code can't show.
- Code volume is not a success metric. Prefer battle-hardened existing dependencies over new ones.
- `crypto.randomUUID` is unavailable in insecure contexts (LAN http) — ALWAYS use `randomUUID` from `@/utils/crypto` for client-side ids.
- better-sqlite3 transactions are synchronous — never async callbacks inside `db.transaction`.
- Run `npm run knip` after significant refactors and remove genuinely dead code.

### Lexical notes

- Lexical NodeState API (0.50+ in use) (`$config`/`createState`, `flat: true`); defaults are omitted from serialised JSON — readers must not assume presence.
- Streaming writes: tag `[HISTORY_MERGE_TAG, SKIP_SCROLL_INTO_VIEW_TAG]` as an ARRAY; push a `HISTORY_PUSH_TAG` boundary first.
- Any OnChangePlugin consumer that must see streamed text needs `ignoreHistoryMergeTagChange={false}`.
- Interactive controls inside decorators need NATIVE keydown stopPropagation via ref.
- Transitive Lexical packages (@lexical/utils, @lexical/selection, @lexical/mark, @lexical/yjs, yjs) must NOT be added to package.json.
