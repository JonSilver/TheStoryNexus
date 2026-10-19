# Lexical editor spike — findings

Spike code: scratchpad `spike-lexical` (standalone Vite + React 19 + TS, Lexical **0.50.0**). `npm run verify` drives the real UI in headless Chromium — **19/19 behavioural checks pass** against dev and production builds. Every claim below is backed by a numbered check; nothing is inferred from source reading alone.

## Summary verdict

**Suitable — proceed.** The custom-node story is the strongest part. Full custom state serialises into the document with zero bespoke import/export code and round-trips byte-identically; streaming 20 tok/sec into the node costs no measurable typing latency and zero undo entries; Accept is one clean undo step that also restores the generated text on undo; in-editor copy/paste preserves all node state; Markdown export from the serialised JSON is ~90 lines. Open risk: mobile decorator interaction (see §9).

## 1. Custom-node ergonomics

Whole SceneBeatNode: **76 lines**. Lexical ≥0.28's `$config()` + `createState`/`stateConfigs` API eliminates the classic boilerplate (`getType/clone/importJSON/exportJSON/constructor`): declare each state field once with a `parse` function that doubles as validator + default provider — malformed persisted JSON degrades to defaults instead of throwing.

Pain points: baroque type machinery (bad inference errors when it goes wrong); `flat: true` puts custom fields at the node JSON's top level (nicer, but decide once project-wide — collision risk with future built-ins); docs lag the API (derived from `.d.ts`, not the guide); state values must be treated as immutable.

## 2. Serialisation

- Complete state lands in editor-state JSON automatically; **defaults are omitted** (don't assume fields present when reading).
- Round-trip serialise → parse → serialise is **byte-identical**.
- ⚠️ `OnChangePlugin`'s `ignoreHistoryMergeTagChange` **defaults to true** — an autosave wired to it silently never sees streamed text (tagged `history-merge`). Must set `ignoreHistoryMergeTagChange={false}`.
- `OnChangePlugin` never fires for the initial state; document mirrors need priming on mount.

## 3. Streaming — node-state vs react-state (both implemented, measured)

**Chosen: node-state** (write tokens into node state via `editor.update` per token). Decisive: react-state keeps generated text _outside_ the document for the whole stream — a data-loss window if the user navigates/backgrounds/crashes mid-generation. Performance objection doesn't exist: 25 keystrokes typed during a 20 tok/sec stream showed **overhead within measurement noise** (−92 ms to +137 ms across runs).

Requirements for safety:

1. Tag token updates `[HISTORY_MERGE_TAG, SKIP_SCROLL_INTO_VIEW_TAG]` **as an array** — a space-joined string silently registers one bogus tag → 41 undo entries per stream instead of 0.
2. Native keydown isolation for the nested textarea (§6).

## 4. Undo

- Accept (insert paragraphs + set status + clear generatedText + move caret) in one `editor.update` tagged `HISTORY_PUSH_TAG` = **exactly one undo step**; undo restores paragraphs _and_ the node's generatedText.
- Streaming adds zero undo entries with the history-merge tag; the explicit HISTORY_PUSH boundary at generation start prevents merge-into-previous-user-edit.

## 5. Copy/paste

- **In-editor**: true node clone via `application/x-lexical-editor` clipboard payload — full state (command, status, 196-char generatedText) preserved, fresh node key. Note: duplicating a beat duplicates its generation; `resetOnCopyNode` exists if we want to suppress.
- **To other apps**: the beat contributes **nothing** to text/plain or text/html (no `exportDOM`, `getTextContent()` = ''). Matches our export rule, but copy-as-prose must use the Markdown serialiser, not native copy.

## 6. Keyboard isolation bug (would have shipped)

Lexical's keydown listener sits on the contenteditable root; React 19 synthetic handlers attach at the React root **above** it, so React `onKeyDown` `stopPropagation` runs too late — Ctrl+A inside the beat's textarea selected nothing at all. Fix: **native** listener via ref callback (`el.addEventListener('keydown', stop)`). Any interactive control inside a decorator needs this.

With `isKeyboardSelectable()`, Backspace from the following paragraph's start selects then deletes the beat correctly.

## 7. Markdown export

90 lines, consumes **serialised JSON not the live editor** (so it runs server-side with no Lexical runtime — preserve this constraint). Data-driven: `TEXT_MARKS` bitmask table + `BLOCK_SERIALISERS` map, `null` = emit nothing (scene beats in every state). Unknown block types fall back to serialising inline children — forward-compatible. Not done: lists, links, images, prose-quality escaping.

## 8. Bundle size

React-only baseline 59.9 kB gzip; full spike 134.8 kB gzip → **Lexical's share ~70–75 kB gzip** for this composition. Tree-shakes properly. Budget ~90–100 kB gzip with lists/links/markdown shortcuts. (Massive reduction vs the vendored playground.)

## 9. Mobile risk (issues research; not device-tested)

The historic case against Lexical on mobile has largely been dismantled recently: all 14 `ios-bug` issues closed; caret-behind-keyboard fixed (PR #8486, visualViewport); IME/composition nearly clear (3 open); 221 issues closed since 2026-06; monthly releases.

**Residual risk concentrates exactly on our feature** — decorator-adjacent caret behaviour: #4859 (can't move between consecutive decorator nodes on mobile — open since 2023, zero comments), #5042, #6916, #7070/#7158, #7618, #2285, #9112. And **no evidence either way** on a nested textarea inside a DecoratorNode on iOS (focus stealing, keyboard scroll, caret escape) — untested territory.

**Mitigation to bake in from day one**: keep the beat's interactive chrome architecturally separable from the decorator (all state access via hook + `editor.update`), so if real iOS testing misbehaves, controls move to a portal/drawer outside the contenteditable and the decorator becomes a display block — without touching node or serialisation.

**Re-run on real iOS Safari and Android Chrome before committing to the in-node textarea design.**

## Cost-of-silence lessons (argue for behavioural tests in the real app)

1. `tag` takes an array, not a space-joined string (silent: 41 undo entries).
2. `OnChangePlugin` ignores history-merge by default (silent: autosave misses streamed text).
3. React synthetic stopPropagation can't isolate decorator keys (silent: broken shortcuts).
