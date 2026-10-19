# TipTap editor spike — findings

Spike code: scratchpad `spike-tiptap` (TipTap 2.27.3) and `spike-tiptap-v3` (same source on 3.31.3). `npm run verify` drives the built app in real Chromium; every number below is from its output. Caveats: Chromium-only (WebKit wouldn't launch on this VM), no physical device — mobile section is desk research.

## Verdict

**Suitable — but build on v3, not v2, and reconsider the atom-node shape of the scene beat before committing to it on mobile.**

## Key findings

1. **Custom node**: 235 lines total (≤150 lean) — schema/attrs/HTML serialisation/commands in SceneBeatNode.ts + React node view. Typed commands end-to-end via declaration merging. Pain points: `updateAttributes` cannot skip undo history (need a hand-written command with `tr.setMeta('addToHistory', false)`); doc-attr-backed textareas need uncontrolled+debounced treatment; `getPos()` must be re-read every tick; v2 re-renders the whole React tree per transaction (v3 fixes the default).

2. **Serialisation**: full control via attrs with per-attr parseHTML/renderHTML (data-\* attributes); round-trips through JSON, HTML, and cross-document paste. TRAP: an atom node contributes nothing to `getText()`/clipboard text until `renderText` is added.

3. **Streaming history pollution — the big finding**: naive attr-update-per-token = **71 undo entries for 71 tokens**; `addToHistory: false` = **0**, and prosemirror-history correctly maps existing entries through skipped transactions (verified: undo after streaming removes the user's typing, leaves streamed text). Use `tr.setNodeAttribute` (AttrStep → node view update(), keeps textarea focus).

4. **Accept**: one command, one transaction, one undo entry; single undo restores the exact prior document including the beat's pending text (byte-compared JSON).

5. **Copy/paste**: full state within editor and across documents (data-\* HTML carries it, even stripped of ProseMirror's clipboard hint). Pending generations duplicate with the node — product decision whether to strip via transformPasted.

6. **Markdown**: hand-rolled serialiser 31 lines; prosemirror-markdown produces byte-identical output and also buys the **parser** (useful for Phase 7 ingestion) at 50.8 kB gzip — lazy-load or server-side. v3 drops the @tiptap/pm re-export; explicit dep.

7. **Bundle**: v2 explicit-imports editor 93.3 kB gz; **v3 explicit 106.4 kB gz**; StarterKit on v3 tree-shakes badly (129.7). Long-doc perf: 60k-word single doc = 6.8–7.7 ms/keystroke, export 3.2 ms — fine, and chapter-per-editor is 10× lighter.

8. **Mobile — medium risk, concentrated exactly on this design**: ProseMirror is at/near the front of contenteditable maintenance (open Android/IME issues: PM ~9, Lexical 23, Slate 60+; monthly prosemirror-view releases full of mobile fixes) — **ProseMirror and Lexical are roughly comparable in practice**. The unfixed cluster is block-level contenteditable=false node views in the prose flow: PM #1424 (iOS tap left of node view jumps caret to doc end, open since 2023), #1214 (gapcursor doesn't work on mobile), #1417 (iOS keyboard overlays editor on focus), TipTap #4315/#7514/#7757. Mitigations: consider a non-atom beat or chrome outside the flow; explicit insert-paragraph-above/below tap targets; visualViewport handling; guard input rules with `view.composing`; test across GBoard/Samsung/SwiftKey.

9. **v2 is on life support**: `latest` = 3.31.3; v2 parked at 2.27.3 (six releases in eleven months vs six in nine days for v3). The v3 port of this spike is byte-identical source apart from a `getPos()` undefined-guard, builds clean, reproduces every result.

## Bottom line

Everything set out to prove was proven in a real browser. The two silent traps: one undo entry per streamed token via naive updateAttributes, and empty clipboard for atom nodes without renderText. The real open question is whether a scene beat should be a block atom in the text flow at all — the unfixed iOS caret/selection bugs live precisely there. Resolve with a physical iPhone before Phase 3 hardens the design.
