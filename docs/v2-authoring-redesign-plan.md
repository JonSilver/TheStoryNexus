# v2 Authoring Redesign — Phased Plan

## Principle

**Writing in front, machinery behind.** The app does the context bookkeeping; the writer never does admin mid-flow. Every feature is judged by how little it interrupts prose. No backward compatibility constraints — schema and content format may change freely.

## Approach

Fresh frontend, retained Express/SQLite/Drizzle server (schema evolves as needed). Old frontend stays runnable until the new one reaches parity, then is deleted along with the vendored Lexical playground remnants.

---

## Phase 0 — Interim trust patch (current app)

Small fixes to the existing app so it's trustworthy while v2 brews.

- Fix save-on-switch data loss: flush the debounced save instead of cancelling it (chapter switch, tool switch, unmount); add `beforeunload` flush.
- Rewrite CLAUDE.md to describe the app as it exists (workspace shell, `src/components/story-editor/`, real routes).

## Phase 1 — Server-side AI

Foundation for everything after; benefits the old frontend immediately.

- Single streaming generation endpoint on the server; provider fan-out (OpenAI, Gemini, OpenRouter, local) moves server-side.
- API keys never sent to the browser.
- Local inference URL resolved from the **server**, so phones/tablets on the network can use local models.
- Per-request abort (no shared singleton abort controller).
- Settings UI: one default model chosen globally; per-action overrides deferred to the advanced drawer (Phase 7).

## Phase 2 — New writing surface

The core of the fresh frontend: open the app, you're writing.

- New frontend shell (mobile-first layout, ~4 primary destinations, sheets not desktop dialogs, safe-areas done properly).
- Lean purpose-built editor: prose blocks, headings, emphasis, horizontal rule, images, scene-beat node. No tables/code/polls/collab baggage. (Editor library chosen during build against these needs.)
- Reliable persistence: debounced save that flushes on every exit path; accurate live word count; `wordCount` column actually maintained.
- Full resume: last story, last chapter, scroll position restored on open.
- Creating a chapter navigates into it.

## Phase 3 — AI in the flow

- Built-in actions that work out of the box: Continue, Rework selection, Expand, Shorten, Summarise chapter, Brainstorm. No prompt or model picking in the writing path.
- Selection actions stream with explicit accept/reject (never overwrite the selection directly, no forced formatting).
- **Per-story voice**: a "Story voice" field on each story for prose style, tense, tone, and framing parameters, injected into the system prompt of every AI action for that story. Editable from story settings. (Bible = facts; voice = style.)
- Summaries generated/refreshable from within the editor, feeding later actions' context.

## Phase 4 — Scene beats v2

- Scene beat state serialised **in the document** (single source of truth; copy/paste, undo, and deletion just work; parallel `sceneBeats` table retired).
- Inline intention UX: type what should happen, generate, accept/reject.
- Automatic context assembly: recent prose, summaries, matched bible entries — no toggles.
- Optional "what I'm sending" inspector showing the assembled context.
- Touch-first insertion: `+` affordance between blocks, correctly implemented slash command (cursor-local matching, proper positioning), Alt+S retained on desktop.

## Phase 5 — Story bible (lorebook evolution)

- Matching fixed: word boundaries, case handling, explicit aliases; no substring false positives; efficient re-matching.
- **Extract from text**: point at a chapter, story, or pasted text → AI proposes entries (characters, locations, items, events) → review/approve/bin before save.
- **Update proposals**: after writing, the app suggests entry updates from new material; writer approves.
- Manual CRUD retained as the correction layer; global/series/story hierarchy retained.

## Phase 6 — Manuscript ingestion

The "bring your existing novel" gateway; pairs with Phase 5.

- Paste or upload `.txt` / `.md` / `.docx` → AI-assisted chapter splitting with a review step → story and chapters created.
- Immediately offers bible extraction over the ingested text (Phase 5 machinery).
- Existing Story-Nexus JSON import retained.

## Phase 7 — Advanced drawer, export, cutover

- Advanced drawer: editable prompt templates behind each built-in action, per-action model routing, context inspection. Present, optional, out of the writing path. Template variables validated (unknown variables are errors, not silent passthrough).
- Export fixes carried into v2: headings and lists correct in Markdown/HTML/EPUB/PDF.
- Cutover: delete old frontend, playground assets/CSS/icons, dead columns and dead prompt types; Knip sweep; docs and guide rewritten (guide accessible on mobile).

---

## Decisions already made

- Fresh frontend, keep server (Guv).
- Built-in actions + advanced overrides, not template-first (Guv).
- Bible = current model + AI extraction, not full auto-maintained rewrite (Guv).
- Per-story voice/system-prompt context is a requirement (Guv).
- Editor library choice is an implementation decision, made during Phase 2.

## Success test

Fresh install → enter one API key → writing with working AI inside two minutes, on a phone, including inserting a scene beat by touch — with zero prompt/model/lorebook admin performed.
