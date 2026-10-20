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
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(Boolean);
const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
// Dialogue and quoted phrases are the story's, never the model's notes
const outsideQuotes = (text: string) => text.replace(/“[^”]*”|"[^"]*"|‘[^’]*’/g, " ");

const TASK_TALK = new RegExp(
    [
        "\\brevis(?:ed|ion|ions)\\b",
        "\\brewr(?:ite|itten|iting|ote)\\b",
        "\\brephras(?:e|ed|ing)\\b",
        "\\breworded\\b",
        "\\bthe original (?:text|passage|sentence|paragraph|version)\\b",
        "\\b(?:changes|improvements|adjustments) (?:I )?(?:made|were made)\\b",
        "\\bas an AI\\b",
        "\\blanguage model\\b",
        "\\bwriting assistant\\b",
        "\\bI(?:'m| am) (?:unable|not able) to\\b",
        "\\bI (?:cannot|can't|won't) (?:proceed|comply|help|assist|provide|rewrite)\\b",
        "\\b(?:happy|glad) to help\\b",
        "\\bhope this helps\\b",
        "\\blet me know\\b",
        "\\b(?:British|American) (?:English )?(?:spellings?|conventions)\\b"
    ].join("|"),
    "i"
);
const HEADING =
    /^\s*(?:(?:revisions?|changes|edits|notes?|explanation)(?: made)?|here(?: is|'s) (?:the|your|a)\b[^\n]*)\s*:\s*$/im;

const isNote = (block: string) => {
    const unquoted = outsideQuotes(block);
    return HEADING.test(unquoted) || TASK_TALK.test(unquoted);
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
