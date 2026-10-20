/**
 * Does a reply offered as a replacement look like more than the passage?
 * Models that ignore "reply with the passage alone" add notes, apologies or
 * a lecture after a perfectly good rewrite. Nothing here trims: it tells
 * the writer what looks wrong, and how many paragraphs their passage had.
 */
export type ReplyAction = "rework" | "expand" | "shorten" | "ask";

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const paragraphs = (text: string) => text.split(/\n+/).filter(line => line.trim()).length;

// Phrases an assistant uses about itself or its work — never a novel's prose
const ASSISTANT_SPEAK = [
    /\bI(?:'m| am)? ?(?:sorry|apologi[sz]e)\b/i,
    /\bas an AI\b/i,
    /\b(?:language model|writing assistant)\b/i,
    /\bI (?:can(?:no|')t|am unable to|'m unable to) (?:proceed|help|comply|assist)\b/i,
    /^\s*(?:revisions?|changes|edits|notes?)(?: made)?\s*:/im,
    /^\s*here(?: is|'s) (?:the|your|a) (?:revised|rewritten|reworked|expanded|shortened|updated)\b/im,
    /\b(?:I hope this helps|let me know if)\b/i
];

// How much longer than the passage a reply may sensibly be — "longer, but not significantly"
const LIMITS: Record<ReplyAction, { growth: number; slack: number; extraParagraphs: number } | null> = {
    rework: { growth: 1.5, slack: 15, extraParagraphs: 0 },
    shorten: { growth: 1, slack: 0, extraParagraphs: 0 },
    expand: { growth: 5, slack: 100, extraParagraphs: Infinity },
    ask: null
};

export interface ReplyCheck {
    concerns: string[];
    /** The passage's paragraph count: what "keep only the passage" keeps. */
    passageParagraphs: number;
    /** The reply has paragraphs beyond that many. */
    hasExtraParagraphs: boolean;
}

export const checkReply = (action: ReplyAction, passage: string, reply: string): ReplyCheck => {
    const passageParagraphs = Math.max(1, paragraphs(passage));
    const limit = LIMITS[action];
    const hasExtraParagraphs = paragraphs(reply) > passageParagraphs;
    const listAdded = /^\s*\d+[.)]\s/m.test(reply) && !/^\s*\d+[.)]\s/m.test(passage);
    const concerns = [
        ASSISTANT_SPEAK.some(pattern => pattern.test(reply)) && "it reads like the model talking about its work",
        listAdded && "it has a numbered list your passage didn't",
        limit && words(reply) > words(passage) * limit.growth + limit.slack && "it's much longer than your passage",
        limit &&
            paragraphs(reply) > passageParagraphs + limit.extraParagraphs &&
            `it has ${paragraphs(reply)} paragraphs where your passage had ${passageParagraphs}`
    ].filter((concern): concern is string => Boolean(concern));
    return { concerns, passageParagraphs, hasExtraParagraphs };
};

/** The reply's first `count` paragraphs, as written. */
export const firstParagraphs = (reply: string, count: number) =>
    reply
        .split(/\n+/)
        .filter(line => line.trim())
        .slice(0, count)
        .join("\n\n");
