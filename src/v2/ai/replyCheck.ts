/**
 * Does a reply offered as a replacement carry more than prose? Models that
 * ignore "reply with the passage alone" put notes before or after a good
 * rewrite — a preamble, a list of revisions, an apology, a lecture. Those
 * paragraphs are found by what they talk about (the task, the text, the
 * assistant), outside quotation marks so dialogue never counts. Nothing is
 * trimmed here: the writer is told, and can choose the reply without the notes.
 */
export type ReplyAction = "rework" | "expand" | "shorten" | "ask";

// Blank lines separate paragraphs, as when prose is inserted (lexicalText)
const blocksOf = (text: string) =>
    text
        // A code fence is wrapping, not prose: it stands as a block of its own
        .replace(/^\s*```\w*\s*$/gm, "\n\n$&\n\n")
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(Boolean);
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
// Dialogue and quoted phrases are the story's, never the model's notes
const outsideQuotes = (text: string) => text.replace(/“[^”]*”|"[^"]*"|‘[^’]*’/g, " ");

// Only what an assistant writes about its own output — never narration ("she rewrote the letter")
const TASK_TALK = new RegExp(
    [
        "\\b(?:revisions?|changes|edits|improvements|adjustments) (?:made|I made|were made|include)\\b",
        "\\b(?:the|this|your|my) (?:revised|rewritten|reworked|rephrased|edited|original) (?:text|passage|sentence|paragraph|version)\\b",
        "\\bthe (?:rewrite|revision|rewritten (?:text|passage|sentence)) (?:maintains|keeps|preserves|retains)\\b",
        "\\bas an AI\\b",
        "\\blanguage model\\b",
        "\\bwriting assistant\\b",
        "\\bI(?:'m|’m| am) (?:unable|not able) to (?:proceed|help|comply|assist|provide|rewrite)\\b",
        "\\bI (?:cannot|can't|can’t|won't|won’t) (?:proceed|comply|help|assist|provide|rewrite)\\b",
        "\\b(?:happy|glad) to help\\b",
        "\\bhope this helps\\b",
        "\\blet me know if\\b",
        "\\b(?:British|American) (?:English )?(?:spellings?|conventions)\\b"
    ].join("|"),
    "i"
);
// A change note quotes the old and new wording: Changed "x" to "y"
const CHANGE_NOTE =
    /\b(?:changed|replaced|modified|swapped|altered)\b[^\n]*["“‘][^"”’\n]+["”’][^\n]*\b(?:to|with|for)\b/i;
// Markdown dressing that hides a heading ("**Here is…:**", "### Revisions:")
const undress = (text: string) => text.replace(/^\s*#+\s*/gm, "").replace(/\*\*|__/g, "");
const HEADING =
    /^\s*(?:(?:revisions?|changes|edits|notes?|explanation)(?: made)?|here(?: is|'s|’s) (?:the|your|a)\b[^\n]*)\s*:\s*$/im;
const FENCE = /^\s*```\w*\s*$/;

const isNote = (block: string) => {
    const plain = undress(block);
    return FENCE.test(plain) || HEADING.test(plain) || CHANGE_NOTE.test(plain) || TASK_TALK.test(outsideQuotes(plain));
};

// "Longer, but not significantly": how much a reply may outgrow its passage
const GROWTH: Partial<Record<ReplyAction, { factor: number; slack: number; concern: string }>> = {
    rework: { factor: 1.5, slack: 15, concern: "it's much longer than your passage" },
    shorten: { factor: 1, slack: 0, concern: "it's longer than your passage" }
};

export interface ReplyCheck {
    concerns: string[];
    /** The reply without the paragraphs that read as the model's notes — when it had any, and prose remains. */
    proseOnly: string | null;
}

export const checkReply = (action: ReplyAction, passage: string, reply: string): ReplyCheck => {
    const blocks = blocksOf(reply);
    const firstProse = blocks.findIndex(block => !isNote(block));
    // Notes lead (a preamble) or trail: from the first note after the prose, the rest is notes
    const trailingFrom = firstProse < 0 ? -1 : blocks.findIndex((block, i) => i > firstProse && isNote(block));
    const prose = firstProse < 0 ? [] : blocks.slice(firstProse, trailingFrom < 0 ? undefined : trailingFrom);
    const hasNotes = firstProse !== 0 || trailingFrom >= 0;
    const growth = GROWTH[action];
    const proseText = prose.join("\n\n");
    const concerns = [
        hasNotes && "part of it reads like the model's notes, not your story",
        growth && words(proseText || reply) > words(passage) * growth.factor + growth.slack && growth.concern
    ].filter((concern): concern is string => Boolean(concern));
    return { concerns, proseOnly: hasNotes && prose.length > 0 ? proseText : null };
};
