# Session handoff

_Last updated 2026-10-20 (third session). Read this first, then CLAUDE.md. Replace it at the end of each session._

## Where things stand

`main` is at the merge of #112, and the live dev server (watching `/home/jon/dev/TheStoryNexus`) is on it. **Migration 0018** (the `transpositions` table) has been applied to the live database. A backup taken just before it is at `data/backups/storynexus-before-0018-20261020-151613.db`. Nothing is in flight, and there are no extra worktrees.

## Merged this session (#108–#113)

- **The model at the point of need (#108).**
    - The action sheets name the model behind each attempt.
    - **Change model**, and **Use a different model for <action>**, save the action's model to the scope that chose the current one, then try again.
    - Override PUT is field by field.
    - Low-impact edges are filed as #107.
- **Duplicate this story (#109, closes #76).**
- **Transpose story (#111, #113, #112, closes #77).** A stack of three PRs, each reviewed by two lanes before merge. It works on a copy, out of its series, layer by layer: brief → synopsis → bible → chapters.
    - The chapters are cut into pieces (`src/v2/transpose/pieces.ts`, shared with the server), drafted outline-then-parts, reviewed beside the original, and rebuilt on the server on accept.
    - The writer sees a cost estimate before the chapter batch starts.
    - The design is in contracts §11a.
    - The full-database import now also restores `actionOverrides`, which it had silently dropped before.
- **E2E ports** can be overridden with `E2E_API_PORT` / `E2E_WEB_PORT`. Another project's Docker container (`long-range-rfid-locator`) held 3101 today, and the runs used 3111/5283.

## Next work, in order

1. **Later: #74 multi-user with login, then #73 encryption at rest.** Build these on the consolidated API layer, with one auth/context provider.
2. **Model per action beyond the sheets (follow-on to #108):** scene-beat takes, ghost continuations, Brainstorm and extraction could name and change their model the same way. This isn't agreed yet; propose it to the user first.
3. **Transposition, left by decision or for later:**
    - An accepted chapter that is edited later still counts as accepted, because polishing in Write is normal.
    - Rewritten parts lose inline formatting.
    - The chapter batch is client-driven, so the tab must stay open.
    - Global bible entries aren't transposed.
4. **Open issues to triage when relevant:**
    - #107: sheet model change edges;
    - #104: stale toolbar selection after accepting a sheet result;
    - #99: overlapping dialogs;
    - #87: Brainstorm two-tab edge cases;
    - #85: chapter cache, same-second metadata writes;
    - #66.

## Known limits of the notes check (#105), left by decision

From the second Codex pass. Revisit if the writer meets them:

- **Missed phrasings.** Notes the heuristic doesn't recognise still pass: "Sorry for the confusion…", "Key improvements:", bullet lists of changes. The phrase list can never be complete. The real remedy is a better model per action (next work, item 1).
- **Over-cutting.** Remove keeps everything before the first trailing note. A story paragraph that happens to match a note pattern (unquoted "I am a writing assistant" dialogue, or `She changed "dawn" to "dusk"`) would cut it and everything after. It only ever adds a new attempt, which the writer sees before accepting.
- **Single-newline notes.** Notes separated from the prose by a single newline make the whole block a note, so a warning appears but no Remove is offered.
- **Length warnings.** Rework over 1.5× plus 15 words, or a shorten that comes back longer, warns. The user asked for this ("longer, but not significantly").

## The writer's setup (configuration only; never read their stories)

- **App default model:** OpenRouter `thedrummer/skyfall-36b-v2`, a roleplay fine-tune. It ignores "prose only" and rambles, which caused today's rework incidents.
- **Summarise chapter override:** `qwen/qwen3.6-27b`, a thinking model, at temperature 0.3. It has previously "finished without producing any text" when hidden reasoning used up its token budget.
- **Other settings:** a local model server URL is set, and there are two favourites, converted from the old per-provider defaults.

## How we work here (practical)

- **Reviews (SOP 3, before merge, never after).** Run two lanes against a detached worktree:
    - **Unprimed Codex:** `codex exec -s danger-full-access -C <worktree> -o <out.md> - < brief.txt`, run in the background. Codex's read-only sandbox fails on this VM (bwrap loopback error).
    - **Primed GLM:** `cd <worktree> && glm-code -p "$(cat brief)"`, run in the background.

    Every brief must say **"Make NO edits and DELETE NOTHING anywhere on this machine"**: a GLM lane once deleted about 2.6G of `/tmp/claude-1000` session files. Reviewers may be wrong. Verify each finding, and reproduce inferred ones with a journey before fixing; GLM's "Refine keys leak into the editor" did not reproduce.

- **Gates.**
    - `npm run verify` is the full gate.
    - Never edit files in a checkout while its gate runs. Vite reloads the app under the tests, so the result is meaningless; if you need to change code, stop the gate first.
    - E2E always uses ports 3101/5273, so only one E2E run at a time across all checkouts.
- **Worktrees.**
    - Use them for schema work and for anything the live dev server shouldn't reload mid-session.
    - Give each its own `npm ci`; a symlinked `node_modules` shares the Vite cache and makes E2E flaky. Review worktrees may symlink, as they don't run E2E.
- **Migrations.**
    - The dev server applies them to the user's real database on restart. Before pulling a migration into `/home/jon/dev/TheStoryNexus`, say so and offer a backup.
    - Generate add-column and drop-column changes as separate migrations, because `drizzle-kit generate` blocks on an interactive rename prompt otherwise. Test data-copy SQL on a scratch in-memory table.
- **Asking.** Ask the user before redesigns, extra review rounds and destructive or irreversible steps (SOP 13), stating the cost. Otherwise finish: commit, push, PR from the diff, merge.

## What this session taught

- **A fix offered from a sheet must happen in the sheet.** A "link to Settings" would have thrown away the writer's attempts, because they live only in memory.
- **A mutation check that passes means the test doesn't reach the code.** Two cases this session:
    - Mocked generation never touches the server's context assembly, so server-side prompt logic needs a `/api/generate/preview` assertion.
    - A flush only proved itself once the save was slowed with a delayed route.
- **`git checkout` can't revert a mutation in an untracked file.** Back the file up, or commit first, before mutating it.
- **Stacked PRs:** fix each layer's review findings on that layer's branch, then rebase the next onto it. Merge bottom up, and retarget each PR onto `main` before merging it.
- **Every review lane found real defects again**, in all five PRs. Reviewers were also wrong at least once: GLM claimed foreign-key cascades never fire, but better-sqlite3 enables `foreign_keys` by default.

## What the previous session taught (also proposed for CLAUDE.md)

- **Review before merge.** #94–#98 were merged unreviewed. The review afterwards found six real defects, three of them introduced by that work. Every review lane since has found real problems: favourites (two), screen context (six), prose-only (three), suspect replies (several).
- **A mutation check must remove only the behaviour.** Stashing files to an older commit crashed the app, so every journey "failed" and proved nothing. Disable the one behaviour, for example with `false &&`, and confirm the unrelated journeys still pass.
- **Negative assertions need a positive anchor.** A `toHaveCount(0)` checked before the screen had rendered passed vacuously. Assert the screen is showing first.
- **Real keystrokes, not `.fill()`,** when the claim is about keys.
- **Prompt wording can't police a model.** The prose-only rule helps, but a disobedient model still needs the app to check what comes back. The fix for an AI output problem is usually prompt plus app-side check plus an easy route to a better model.
- **Problem reports are UX reports first (SOP 11).** Each time today, the useful first answer was what the app showed the writer and why that was not good enough.
