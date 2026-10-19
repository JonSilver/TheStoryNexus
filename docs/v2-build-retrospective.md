# v2 Build — Process Retrospective

An honest post-mortem of how the rebuild went: what worked, what ground, and what would make AI-driven work on this repo easier next time. Written at the end of the build, before cutover.

## What worked — keep doing these

1. **A binding contracts document** (`v2-contracts.md`). Every builder, reviewer, and fix anchored to the same spec; deviations were logged rather than drifting silently. The single most valuable artefact of the project — reviews repeatedly caught real bugs _as spec violations_ that pure code-reading would have shrugged at.
2. **Spiking the editor before committing to it.** The Lexical spike surfaced three silent failure modes (tag arrays, `ignoreHistoryMergeTagChange`, native keydown isolation) that each would have shipped as mystery bugs. Cost: one afternoon of agents. Value: the entire editor works.
3. **Adversarial review with fix re-verification.** Two independent reviewers (Codex, GLM), every phase, and — critically — _reviews of the fix batches themselves_. My own Stop-button regression was introduced by a review fix and caught only because both reviewers independently re-examined the fixes. Fixes are code; code gets reviewed. No exceptions.
4. **Behavioural verification in a real browser** over trusting unit tests for editor work. Every editor claim in this repo was proven by driving the actual UI; the spikes' philosophy ("nothing inferred from source alone") caught what static analysis never would.
5. **Parallel delegation for separable chunks** (spikes, export module, assets, ingestion server, guide) while the orchestrating session held the risky integrative work (editor, saves, streaming). Distinct file paths per agent avoided merge pain entirely.

## What ground — and the remedies

1. **Test data polluted the live dev database.** The "Harbour Lights" crash-test story, mock-model settings, and phantom defaults all leaked into the database the owner then opened, reading as a broken app. _Remedy adopted:_ purge + demo auto-seed. _Remedy still owed:_ verification runs should use an isolated `DATABASE_PATH`; a `dev:scratch` script would make that one command.
2. **The localhost blind spot.** All browser verification ran on `localhost` (a secure context), so the `crypto.randomUUID` insecure-context break — which killed _every_ AI feature over LAN, the app's primary use case — survived until the owner hit it. _Remedy adopted:_ LAN-origin verification is now part of the loop; the safe-UUID helper is used everywhere. _Lesson:_ for a LAN-first app, the LAN origin **is** the primary test environment, not an afterthought.
3. **Stale server processes lied twice.** Non-watch dev servers kept old code answering the port, producing two phantom-bug chases (one "validation not working", one "action ids unknown"). _Remedy adopted:_ watch mode + checking which pid owns the port before believing any server behaviour.
4. **Subagent final reports went missing twice** (idle notifications arrived without the report; one agent was barred by harness policy from writing its FINDINGS.md). Re-requesting worked but cost round trips. _Lesson:_ have agents deliver reports in the message **and** verify their work products directly rather than waiting on prose.
5. **Docs drift compounded.** CLAUDE.md described an app that no longer existed (wrong editor location, dead routes, even the wrong React major). It misdirected the initial survey and would have sabotaged the spikes. _Remedy adopted:_ rewritten early. _Remedy owed:_ CLAUDE.md needs its v2 update at cutover, and the release script should include a docs-current check.
6. **The reviewers' scope anchors.** Each review covers a commit range; work landing after the anchor is unreviewed by definition. This is fine _if_ tracked deliberately — it was nearly missed once. The "what range has never been reviewed?" question should be asked explicitly before any milestone.

## Where AI involvement could be easier

1. **`npm run verify`** — added during this retrospective: one command for lint + both typechecks + tests. Agents (and humans) no longer need to know four commands.
2. **CI is absent.** Everything rests on whoever remembered to run verify. A minimal GitHub Actions workflow (verify + build) would catch drift on every push, including agent-authored ones. _Recommended; not added without a nod._
3. **A behavioural smoke suite in-repo.** The editor spike's `npm run verify` (headless-browser assertions of real behaviour) was the project's best safety idea and lives only in an archived tarball. A small playwright smoke of the golden path — create story → write → beat → generate(mock) → accept → export — would guard the whole stack. _Recommended follow-up._
4. **Network topology documentation.** The dev VM and the model server sit on different subnets; that cost a debugging round trip that a two-line note in the deployment docs would have prevented. (Noted in DEPLOYMENT.md's local-models section now.)
5. **The sequential-tool-execution protocol in CLAUDE.md** (October 2025 platform-defect workaround) was honoured throughout and materially slows agent work — every independent read serialised. If the underlying platform defect is confirmed fixed, retiring that section would be the single biggest speed-up to AI work on this repo. _Owner's call._
6. **Mock-model harness as a first-class dev tool.** The throwaway mock LLM built for verification was used constantly (streaming, extraction, updates). Promoting a configurable mock into `devscripts/` would give free, fast, deterministic AI-path testing forever. _Recommended follow-up._

## Outstanding at time of writing

- Third-round adversarial reviews in flight over the final fix batches.
- Cutover (delete v1 workspace + playground, retire `sceneBeats`/`prompts` tables and per-provider default columns, Knip sweep, CLAUDE.md v2 update) — awaiting the owner's word.
- Browser Markdown/HTML exports reference images rather than bundling them (logged deviation; EPUB embeds).
