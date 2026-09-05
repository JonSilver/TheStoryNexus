# v2 Contracts & Foundations Spec

Editor-independent contracts for the v2 build. The editor-specific serialisation appendix is completed after the Phase 1 editor spike. Everything here is binding on later phases; changes require a documented decision.

## 1. Document model

A chapter document is a sequence of **blocks**; inline text carries **marks**.

| Block | Notes |
| --- | --- |
| `paragraph` | Inline children with marks |
| `heading` | Levels 1–3 only |
| `bulletList` / `orderedList` | Items contain paragraphs |
| `horizontalRule` | — |
| `image` | `src` (server asset URL — never data URLs), `alt`, optional `caption` |
| `sceneBeat` | See §2 |

Marks: `bold`, `italic`, `underline`. Nothing else. No tables, code, layout, collab, hashtags, page breaks (page breaks are a print concern; EPUB/PDF derive breaks from headings).

Invariants:

- The document is self-contained: no node references external DB rows for its own state.
- Any v2 document must round-trip its own serialisation and export deterministically to every target in §3.
- Word count = text of paragraphs/headings/lists only; scene-beat internals excluded.

## 2. Scene beat lifecycle

Node state (fully serialised in-document): `{ beatId, command, povCharacter?, povType?, status: 'idle' | 'generating' | 'done', generatedText, collapsed }`.

- **Streaming**: tokens accumulate in component state during generation (NOT written to the document per token — avoids undo-history pollution and save churn); committed to `generatedText` + `status: 'done'` in one transaction at completion or abort.
- **Accept**: one transaction — insert `generatedText` as ordinary paragraph blocks after the node, set node `generatedText: ''`, `status: 'idle'`, `collapsed: true`. One undo step reverts the whole accept.
- **Reject**: clear `generatedText`, `status: 'idle'`. No trace retained.
- **Copy/paste**: node state travels with the copy; `beatId` is regenerated on paste (state is self-contained, so duplicates are harmless). Cross-story paste is legal.
- **Delete while generating**: client aborts that request via its `requestId`; no orphaned anything (no table).
- **Persistence mid-generation**: a save during generation stores the node as it last was committed (streaming text is not persisted until completion).
- **Export/word count**: scene-beat nodes emit nothing in any export target and count zero words, in every status.

## 3. Export mapping

One canonical converter: document JSON → intermediate block list → per-target renderers (Markdown, HTML, EPUB XHTML, PDF, AI plain text). Snapshot fixtures required for every block/mark type per target. Rules:

- Headings → `#`×level / `<h{level}>`; lists → `-` / `1.` / `<ul>/<ol>`; HR → `---` / `<hr>`; marks → `**` `*` `<u>` / tags.
- Images: EPUB embeds the asset; Markdown/HTML reference the relative asset path; PDF embeds; AI plain text omits. (Deviation log: browser Markdown/HTML downloads do not yet bundle assets into a zip — references only; EPUB is the with-images export.) Image `src` values are restricted to `/api/assets/` at the parser, so no exporter can be steered at other URLs.
- Scene beats: omitted everywhere.
- All HTML/EPUB output is escaped (v1's EPUB interpolates raw text — must not survive).

## 4. Asset model (images)

- `POST /api/stories/:storyId/assets` — multer to disk at `{dataDir}/assets/{storyId}/{uuid}.{ext}`; 10 MB/file cap; images only.
- Documents store the served relative URL (`/api/assets/{storyId}/{file}`).
- Deleting a story deletes its asset directory. An orphan sweep (assets unreferenced by any chapter) runs on demand from settings, not automatically.

## 5. Action registry

Data-driven; built-ins defined in code, overrides in DB.

```ts
type ActionId =
    | 'continue' | 'rework' | 'expand' | 'shorten'
    | 'summarise_chapter' | 'brainstorm' | 'scene_beat'
    | 'extract_entries' | 'propose_updates';
// Deviation log: split_chapters was dropped — ingestion splits chapters
// rule-based server-side with a human review step; no AI action needed.

type ActionDef = {
    id: ActionId;
    label: string;
    voiceApplies: boolean;            // §8 — true only for prose actions
    contextNeeds: ContextKey[];       // e.g. 'selection', 'recentProse', 'matchedEntries', 'summaries', 'command'
    defaultTemplate: PromptMessage[]; // {{variable}} slots drawn from contextNeeds — unknown variables are validation errors
    defaultParams: { temperature: number; maxTokens: number; topP?: number };
};
```

`voiceApplies: true`: continue, rework, expand, shorten, scene_beat, brainstorm. `false`: summarise_chapter, extract_entries, propose_updates.

Overrides table `actionOverrides { id, actionId, storyId | null, template?, params?, modelRef? }` — `storyId: null` = global. Precedence: story override → global override → built-in. Sampling params are REAL columns (v1's integer `temperature` bug must not recur). Overrides are validated at save AND at execution (fall back to built-in on invalid). UI for overrides arrives Phase 8; the storage and resolution exist from Phase 2.

## 6. Generation API

```
POST /api/generate/action
{ requestId, actionId, storyId, chapterId?, editorContext: { selection?, recentProse?, command?, povCharacter?, povType?, userMessage?, chatHistory? }, modelRef? }
→ SSE: event: token {text} | finish {reason} | error {message} | aborted
POST /api/generate/preview  — same body minus requestId; returns resolved messages + model + prompt token count (the inspector)
POST /api/generate/abort { requestId }
POST /api/generate          — raw-messages mode, v1-frontend compatibility only; deleted at cutover
```

(Deviation log: a `usage` event is not emitted — nothing consumes it; add if a consumer appears.)

- Server owns: template resolution (registry + overrides), voice injection, summary retrieval (fresh only, §9), lorebook matching over supplied text + stored chapter content (§7), token budgeting (§10), provider fan-out, model fallback.
- Client owns: editor-derived text (selection, recent prose tail, scene-beat command) — the server never parses editor JSON for generation.
- One `AbortController` per `requestId`; client socket close aborts upstream; concurrent generations are independent.
- SSE parsing (client) must buffer across chunk boundaries — v1's split-on-newline-per-chunk parser is banned.
- Errors after tokens have streamed terminate with `error`; no automatic retry.

## 7. Lorebook matching

- Alias set per entry = name + tags. Matching is case-insensitive, Unicode-normalised (NFKC casefold), on **word boundaries**; multi-word aliases match as phrases; trailing possessive `'s` tolerated.
- Disabled entries excluded. Collisions (same alias, multiple levels): story beats series beats global; equal level → all match.
- Ranking: level specificity, then occurrence count. Deterministic truncation by rank under the token budget.
- Implemented server-side as a pure module with tests; the same module serves editor highlighting via an endpoint if needed.

## 8. Story voice

`stories.aiInstructions` (text): style, tense, tone, framing rules. Appended to the system message for actions with `voiceApplies: true` only. Inspectable via the resolved-prompt view (Phase 5 inspector / Phase 8 drawer). Soft cap ~2,000 chars with UI counter.

## 9. Revisions, saves, summary freshness

- `chapters` gains `revision` (int, ++ per content save), `updatedAt`, `summarySourceRevision`.
- Chapter content PUT carries `expectedRevision`; mismatch → 409 + current row; client reloads and informs. One in-flight save per chapter, trailing coalesce; flush on chapter switch, tool switch, unmount, `pagehide`, `visibilitychange: hidden`. Save state (saving/saved/failed+retry) visible in the editor chrome.
- Summary is **fresh** iff `summarySourceRevision === revision`. Stale summaries: labelled in UI; included in generation context with a `[may be outdated]` marker rather than dropped (continuity beats omission).

## 10. Token budgeting

Per request: `budget = modelContextLimit − maxTokens − resolvedTemplateSize`. Fill order (drop from the bottom when over budget):

1. System + voice + action template (fixed)
2. Selection / scene-beat command / user message (fixed)
3. Recent prose, tail-first, up to 60% of remainder
4. Matched entries by rank
5. Prior-chapter summaries, nearest-first

Model context limits come from provider metadata where available, else a conservative per-provider default table — never v1's hard-coded 4096.

## 11. Settings & model selection

- `aiSettings` gains `defaultProvider` + `defaultModelId` (single global default). Auto-selected on first successful key validation + model fetch. If the default vanishes: fall back to first available model, persist, surface a toast. Per-provider default columns retired at cutover.
- Settings GET returns `hasOpenaiKey`-style booleans — never key material. Keys set via `PUT /api/ai/keys/:provider` (write-only). Keys stripped from full-DB export. (Keys remain plaintext at rest — accepted for trusted-LAN scope.)

## 12. Schema change summary

| Table | Change | When |
| --- | --- | --- |
| `chapters` | + `revision`, `updatedAt`, `summarySourceRevision` | Phase 3 |
| `stories` | + `aiInstructions` | Phase 4 |
| `aiSettings` | + `defaultProvider`, `defaultModelId`; key redaction at API layer | Phase 2 |
| `actionOverrides` | new | Phase 2 (storage), Phase 8 (UI) |
| `sceneBeats` | retired (dropped) | Phase 5 |
| `prompts` | retired in favour of registry + overrides | Phase 8 |
| — | destructive v1 reset: v2 ships a fresh-DB migration baseline; sample story re-seeded in v2 format | Phase 3 |

## Appendix A — editor choice & serialisation (decided 2026-09-05)

**Chosen: Lexical 0.50+, lean purpose-built composition.** Both spikes (see `docs/spikes/lexical-findings.md`, `docs/spikes/tiptap-findings.md`) proved every §1–§2 requirement in a real browser: in-document scene-beat state, zero-undo-entry streaming, single-undo Accept with exact restoration, state-preserving in-editor copy/paste, small Markdown serialisers from serialised JSON. Both verdicts were "suitable"; the tie broke on:

- **Node ergonomics**: Lexical's NodeState API needs 76 lines and zero bespoke serialisation vs ~150–235 for TipTap attrs.
- **Bundle**: ~75 kB gzip vs ~106 kB (TipTap v3 explicit imports).
- **Momentum**: Lexical's 2026 mobile triage wave (all `ios-bug` issues closed, IME nearly clear, monthly releases); TipTap would force a v3 adoption (v2 is parked).
- **Incumbency**: the codebase, its serialised content history, and its author know Lexical idiom.

TipTap's genuine advantages — cross-app HTML clipboard fidelity, prosemirror-markdown's parser for ingestion — are replicable in Lexical (`exportDOM`, `@lexical/markdown`) when needed.

**Mobile risk (both spikes converge)**: the unfixed platform bugs cluster on block-level non-editable nodes in the prose flow — exactly a scene beat. Binding mitigations:

1. The beat's interactive chrome stays architecturally separable from the decorator (all state access via hook + `editor.update`), so controls can move to a portal/sheet outside the contenteditable if iOS misbehaves, without touching node or serialisation.
2. Real-device testing (iOS Safari + Android Chrome) of the scene-beat interaction is an early Phase 3 gate, before the in-node textarea design hardens.
3. Explicit insert-paragraph-above/below affordances rather than relying on caret placement around decorators.

**Serialisation shape** (supersedes §2's `beatId` — the node's identity is its Lexical key at runtime; no serialised id is needed since state is self-contained and paste-clones are independent):

```json
{ "type": "scene-beat-v2", "version": 1,
  "command": "…", "status": "idle|generating|done|accepted",
  "generatedText": "…", "collapsed": false,
  "povCharacter": "…", "povType": "…" }
```

Two amendments made during build, both deliberate: the type is **`scene-beat-v2`** because v1 also registers `scene-beat` and each editor silently destroyed the other's node state when they shared the name (live-verified data loss; v1 now shows v2 documents read-only). And **`accepted`** is a fourth status so a beat whose output was taken into the document is distinguishable from one never run; a serialised `generating` is normalised to `done` on parse (an orphaned stream by definition).

Fields are declared via `createState` with `flat: true` (project-wide decision); parse functions provide defaults, and **defaults are omitted from JSON** — readers must not assume presence.

**Implementation notes carried from the spikes (all silent failure modes):**

- Streaming writes go to node state per token (durable mid-stream), tagged `[HISTORY_MERGE_TAG, SKIP_SCROLL_INTO_VIEW_TAG]` — as an **array**, never a joined string.
- A `HISTORY_PUSH_TAG` boundary transaction at generation start; Accept is one `editor.update` tagged `HISTORY_PUSH_TAG`.
- Any `OnChangePlugin` consumer (autosave!) must set `ignoreHistoryMergeTagChange={false}` or it never sees streamed text; document mirrors need an initial-state prime on mount.
- Interactive controls inside decorators need **native** keydown `stopPropagation` via ref (React synthetic handlers run after Lexical's root listener).
- Export runs from serialised JSON (no live editor), data-driven serialiser tables, unknown block types fall back to inline children.
- Behavioural verify checks (headless browser) are kept in the real project — every trap found was silent.
