# Plan: Transpose story (#77)

_One page, for agreement before any code. Builds on #76 (Duplicate story)._

## Writer-visible outcome

On the Story hub, **Transpose story…** asks for the target ("1990s Belfast, a Catholic family running a corner shop"). It makes a copy, named for the target, and opens the **Transpose** screen on that copy. The original is never touched. The screen walks four layers, top down. Each layer is reviewed and accepted before the next one starts, and every result keeps its earlier attempts. Progress is saved, so the writer can leave and resume.

1. **Brief.** The AI drafts a mapping: places, institutions, technology, customs and idiom, plus the new social pressures that do the work the originals did. The writer edits it and accepts it. Every later step is sent the brief.
2. **Synopsis.** The story synopsis is rewritten against the brief.
3. **Bible.** Each story-level entry is rewritten (name, aliases, category, description) as a list with **Accept** / **Try again** / edit per entry. Nothing moves to prose until every entry is decided.
4. **Chapters, in order.** For each chapter, the summary/outline is transposed first, then the prose, scene by scene. The result is a reviewable draft shown beside the original (accept / try again / edit). Progress reads _Chapter 7 of 50 · scene 3 of 5_. **Stop** keeps whatever has finished, and two failures in a row stop the run and say why (the same rule as the whole-story extraction).

Before chapters start, the screen shows a **cost estimate**: number of calls, approximate tokens in and out, and the model that will do it, with **Change model**, as on the action sheets.

## Shape

- **Storage:** a new `transpositions` table (one migration) holding `storyId` (the copy), `sourceStoryId`, `target`, `brief`, `stage`, and per-chapter progress and drafts (each with its attempts, so nothing generated is lost). It goes into backups and duplicates like everything else.
    - A chapter's prose is only written into the copy's chapter on Accept, through the normal `saveVersion` save, so revision and summary freshness behave as usual.
    - Until then the chapter keeps its old text, so the copy is always readable.
- **Actions:** new built-ins `transpose_brief`, `transpose_synopsis`, `transpose_entry` (JSON reply), `transpose_outline` and `transpose_prose` (`insertsProse`). Like any other action, they're overridable in Settings → AI actions, have their own model, and appear in the "What gets sent" inspector.
- **New context keys:** `transposition_brief`, `story_synopsis`, `story_bible` (every story entry, budgeted), `chapter_outline`, `source_passage`, `transposed_summaries` (the chapters already done), and `previous_passage` (the tail of the last transposed scene, for continuity). None of these exist today; context only offers matched entries and earlier summaries.
- **Splitting:** a scene splitter over the chapter's document blocks, splitting at horizontal rules and then at paragraph boundaries until each piece fits.
    - Each piece's input and its expected output both have to fit the window: output is capped at half the window, and a rewrite comes out about as long as its source.
    - Scene breaks are put back between pieces. Images and other non-prose blocks pass through untouched.
    - The text the model sees today drops horizontal rules, so this splitter is new; ingest's separator code is private and only finds chapter breaks.
- **Runner:** client-driven, like the whole-story extraction (`useStorySweep`), with resume from the saved progress. The tab has to stay open while it runs. A server-side job runner is out of scope.
- **Spend (SOP 12):** every call is started by the writer (Start / Continue / Try again). Nothing runs on open, on resume, or in the background.

## Known costs and limits

- Rewritten prose comes back as plain paragraphs: bold and italic inside a transposed passage are lost (`toLexicalDocument` keeps paragraphs, headings and breaks only). The plan states this on screen rather than hiding it.
- Undecided scene beats and ghosts in the source are skipped, with a warning listing the chapters that have them (the same check exports use).
- A 50-chapter book is hundreds of long calls. The estimate is what makes that a choice rather than a surprise.

## Decisions needed from you

1. **Series.** A duplicate stays in its series (#76), but series and global bible entries belong to other stories and must not be rewritten. Recommended: the transposed copy **leaves the series**, and the series entries it used are copied in as its own story-level entries, so they can be transposed too.
2. **Where drafts live.** Recommended as above: drafts sit beside the chapter until accepted. The alternative is writing straight into the copy's chapters, since it is a copy anyway. That's simpler, but a half-done copy then mixes eras.
3. **Delivery in three PRs**, each with its E2E journey:
    - (a) copy, brief, synopsis and bible;
    - (b) chapter outlines and prose with the splitter;
    - (c) the cost estimate, stop/resume polish and guide.

    The final journey: a two-chapter story with mocked AI, run brief → chapters, and the original unchanged afterwards.
