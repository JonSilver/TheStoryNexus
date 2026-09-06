# v2 Authoring Redesign — Phased Plan (rev 2)

Rev 2 restructures the original plan after adversarial review (Codex + GLM, 2026-09-05): the document format and editor choice move ahead of all editor code; matching and context assembly move ahead of scene beats; server-side AI gains explicit security and streaming semantics; persistence gains revision semantics; a test harness and per-phase gates are added.

## Principle

**Writing in front, machinery behind.** The app does the context bookkeeping; the writer never does admin mid-flow. Every feature is judged by how little it interrupts prose.

## Approach & policies

- Fresh frontend; retained Express/SQLite/Drizzle server, schema evolving freely.
- **v1 data policy: destructive reset.** v1 databases and v1 JSON exports are unsupported by v2. The guide documents a pre-upgrade escape hatch (export everything to Markdown/text from v1). The sample/demo story is re-authored as v2-format seed data; demo-content machinery (`isDemo`, seeding, selective deletion) is retained.
- **Parity keep list** (cutover deletes nothing else silently): notes tool, brainstorm chat + history, reader mode, series management, demo machinery + sample story seeding, full-DB export/import (**with API keys stripped from exports**).
- **Security scope**: trusted LAN, no auth layer. But keys are never sent to any browser and never included in exports (see Phase 2). Local-inference URL gets basic validation, not full SSRF hardening.
- **Out of scope for v2**: offline editing/PWA, multi-user, collaborative editing. Two-device sequential editing is supported via revision checks; simultaneous same-chapter editing on two devices is explicitly unsupported.
- **Testing**: vitest introduced in Phase 1. Each phase has gates listed; failure-prone paths (serialisation, saves, matching, stream framing, importers) get regression tests. Mobile verification is informal but explicit: iOS Safari + Android Chrome.

---

## Phase 0 — Interim trust patch (current app) ✅ done

- Save-on-switch data loss fixed (flush not cancel; `beforeunload` + `pagehide` + `visibilitychange` flushes).
- Always-visible scene-beat toolbar button — first discoverable touch insertion path.
- CLAUDE.md rewritten to match reality; dead aliases and stale knip ignore removed.

## Phase 1 — Contracts & foundations (specs + spike, minimal code)

The load-bearing decisions, made before anything is built on them.

- **Document format spec**: canonical chapter document schema — block types (prose, headings, emphasis, HR, images, scene beats), how scene-beat state serialises in-document (command, POV, streamed/accepted/rejected content, lifecycle: delete-while-generating, copy semantics, accept behaviour), and the export mapping for every node type to Markdown/HTML/EPUB/PDF/AI-plain-text.
- **Editor spike**: 2–3 candidates (trimmed Lexical, TipTap, other) each implementing a scene-beat-style custom node with streamed content + Markdown export + a phone sanity test. Pick one; record why.
- **Asset model**: images stored server-side (multer to disk, per-story directory, GC on story delete, size caps) — never data-URLs in the document.
- **Action registry design**: stable action IDs, required context, default template + params per action, global/per-story override model, validation rules. Designed now so Phase 8's advanced drawer edits existing structure rather than forcing a rebuild.
- **Generation API contract**: client sends action ID + story/chapter refs + editor-derived text (selection, recent prose); server resolves voice, summaries, matched entries, composes messages. SSE event types: token, usage, finish, error, aborted.
- **Test harness**: vitest wired into `npm test`; first fixtures for document serialisation.

Gate: written spec in `docs/`, spike branches with conclusions, editor chosen.

## Phase 2 — Server-side AI & settings

- Streaming generation endpoint per the Phase 1 contract: provider fan-out server-side, per-request abort, upstream abort on client disconnect, correct SSE framing across chunk boundaries (current client parser drops partial frames — not to be transplanted).
- **Key redaction**: settings API returns `hasOpenAIKey`-style booleans; keys accepted via write-only endpoints; never echoed; **stripped from full-DB export**; old plaintext column values retained server-side only.
- Old frontend's generation rewired onto the new endpoint — keys stop reaching browsers now, not at cutover; local models start working from phones now.
- **Global default model**: `defaultProvider` + `defaultModelId`; auto-selected when the first key is validated and models fetch; fallback to any available model when the default disappears; per-action overrides defer to Phase 8.
- Sampling-param schema fixed (floats for temperature/top_p).
- Local inference: connection-test button; Docker host-gateway documentation (`host.docker.internal` / `extra_hosts`); URL validated as http(s) to a plausible host.

Gate: generation works old-frontend end-to-end via server; keys absent from every response body and export; stream abort verified both directions.

## Phase 3 — New writing surface

- New mobile-first shell (~4 primary destinations incl. Write; bible/series/settings live in sheets/secondary navigation; full-screen sheets replace desktop dialogs; safe-areas audited).
- Editor built per the Phase 1 spec, including scene-beat node rendering (generation UX arrives Phase 5).
- **Revision-aware persistence**: chapters gain `updatedAt`/revision; saves carry the expected revision (409 on mismatch with a reload path); one in-flight save per chapter with coalescing; visible saving/saved/failed state; flush on all exit paths.
- Export converters implemented against the spec **now**, with snapshot fixtures for every node type (headings, lists gone wrong in v1 must be impossible here).
- Image upload to the Phase 1 asset model.
- Accurate live word count; `wordCount` column maintained; scene-beat machinery excluded from counts.
- **Resume**: per-story last chapter (fallback when deleted), caret/scroll anchor restored after load; creating a chapter navigates into it.

Gate: serialisation + export fixtures green; kill-the-tab-mid-typing test recovers within one debounce window; two-device sequential edit doesn't clobber.

## Phase 4 — Context & AI actions ⭐ declared ship-point after this phase

- **Matching fixed first**: word-boundary, case/Unicode-normalised matching; multi-word tags and possessives; hierarchy collision rules (story > series > global); disabled entries excluded; deterministic ranking + truncation; efficient re-match on edit.
- **Server-side context assembly**: recent prose + fresh summaries + matched entries, under an explicit token budget with a defined degradation order (trim oldest prose → drop least-ranked entries → drop stale summaries).
- **Built-in actions** working out of the box: Continue, Rework selection, Expand, Shorten, Summarise chapter, Brainstorm. Selection actions stream to a preview with accept/reject — never overwriting the selection, never forcing formatting.
- **Story voice**: per-story style/framing/system context field, injected into **prose actions only** (Continue/Rework/Expand/Shorten/scene beats/brainstorm), never extraction/summaries/splitting. Editable in story settings.
- **Summary freshness**: `contentRevision` + `summarySourceRevision`; stale summaries labelled in UI and excluded (or labelled) in context; regeneration from within the editor.

Gate: fresh install → one key → writing with working AI on a phone within two minutes, zero admin. This is the plan's success test, landed here rather than at the end.

## Phase 5 — Scene beats v2

- Scene beat generation UX on the in-document node: type intention, generate, accept/reject; context assembled automatically via Phase 4 machinery; no toggles.
- Optional "what I'm sending" inspector (resolved messages view).
- Touch-first insertion: `+` affordance between blocks; correctly implemented slash command (cursor-local, editor-container positioning); Alt+S on desktop.
- `sceneBeats` table retired; lifecycle semantics per the Phase 1 spec (copy/paste, delete-while-generating, undo across accept).

Gate: insert → generate → accept round-trips on a phone; copy/paste and undo behave per spec.

## Phase 6 — Story bible AI

- **Extract from text**: chapter, story, or pasted text → proposed entries (characters, locations, items, events) → review/approve/bin before save. Chunked for long inputs.
- **Update proposals**: explicitly user-triggered ("scan for updates") — never auto-fired paid API usage; per-entry accept/reject diffs.
- Manual CRUD remains the correction layer; hierarchy retained.

Gate: extraction over the sample story produces sane, deduplicated proposals; nothing saves without approval.

## Phase 7 — Manuscript ingestion

- Paste or upload `.txt` / `.md` / `.docx` / `.epub` (mammoth + epub parser deps; size caps; in-memory limits respected).
- Rule-based chapter splitting first (headings/patterns), AI-assisted fallback, always a review step before creation; transactional story+chapter creation only on approval.
- Immediate bible-extraction offer over ingested text (Phase 6 machinery).
- v2 JSON import/export for stories/series/lorebook/prompts (v1 JSON explicitly rejected with a clear message).

Gate: a real novel-length `.docx` round-trips to correct chapters; malformed files rejected cleanly.

## Phase 8 — Advanced drawer & cutover

- Advanced drawer: per-action template overrides (global + per-story) editing the Phase 1 registry structures; per-action model routing; validated variables (unknown = error, not silent passthrough); resolved-prompt inspection.
- Full-DB export/import against the final schema (keys stripped).
- Cutover: delete old frontend, playground assets/CSS/icons, retired tables/columns, dead prompt types; Knip sweep; sample story re-seeded in v2 format; guide rewritten and reachable on mobile.

Gate: Knip clean; keep-list features all present; guide's every claim true on a phone.

---

## Decisions log

- Fresh frontend, keep server (Guv). Built-in actions + advanced overrides (Guv). Bible = current model + AI extraction (Guv). Per-story voice/system context required (Guv).
- Destructive v1 reset; sample-story seeding retained (Guv). Keep: notes, brainstorm, reader, demo machinery (Guv). No LAN auth — trusted network (Guv).
- Editor library chosen at end of Phase 1 spike, against spec requirements.
- Voice scoped to prose actions only (review finding, accepted).
- Reviewer items rejected as over-scope for a single-user LAN app: auth/CSRF/rate-limiting, encryption at rest, revision history/write-queue, formal device matrices, hostile-archive forensics, offline/PWA.
