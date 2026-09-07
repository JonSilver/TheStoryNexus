/**
 * Rule-based manuscript chapter splitting (Phase 7).
 *
 * Pure and deterministic: no AI, no I/O. The ingestion flow always shows the result for
 * review before anything is written, so the bias here is towards never losing text —
 * unrecognised front matter becomes its own chapter rather than being silently dropped.
 *
 * Precedence: markdown headings -> prose chapter headings -> bare numbers (only when they
 * carve out chapter-sized pieces, since page numbers look identical) -> scene separators
 * (same proviso) -> length-based chunking.
 */
import { countWords } from "../../../src/utils/textUtils.js";

export interface SplitChapter {
    title: string;
    body: string;
}

/** `weak` patterns are indistinguishable from page numbers, so they must earn their split. */
type HeadingKind = "markdown" | "strong" | "weak";

export interface DetectedHeading {
    /** Zero-based index into the text's lines. */
    index: number;
    title: string;
    kind: HeadingKind;
}

const MAX_HEADING_LENGTH = 120;
const FRONT_MATTER_TITLE = "Front Matter";
const SINGLE_CHAPTER_WORD_LIMIT = 10_000;
const TARGET_CHUNK_WORDS = 4_000;
const MIN_TRAILING_CHUNK_WORDS = 500;
const MIN_MEAN_SECTION_WORDS = 150;
const SEPARATOR_MIN_MEAN_WORDS = 1_000;

const NUMBER_WORDS = [
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen",
    "twenty",
    "thirty",
    "forty",
    "fifty",
    "sixty",
    "seventy",
    "eighty",
    "ninety",
    "hundred"
];

/** Digits, roman numerals or a spelled-out ordinal, optionally compound ("twenty-one"). */
const ORDINAL = `\\d{1,4}|[ivxlcdm]+|(?:${NUMBER_WORDS.join("|")})(?:[ -](?:${NUMBER_WORDS.join("|")}))?`;

const SECTION_WORDS = "prologue|epilogue|interlude|foreword|afterword|preface|prelude|introduction|epigraph";

/**
 * Line-start patterns that open a chapter, most specific first. `group` selects the
 * displayed title: 0 keeps the whole line, 1 takes the capture.
 */
const HEADING_PATTERNS: readonly { pattern: RegExp; group: number; kind: HeadingKind }[] = [
    { pattern: /^#{1,6}[ \t]+(.+?)[ \t]*#*$/, group: 1, kind: "markdown" },
    { pattern: new RegExp(`^chapter[ \\t]+(?:${ORDINAL})\\b.*$`, "i"), group: 0, kind: "strong" },
    { pattern: /^chapter[ \t]*[:.]?$/i, group: 0, kind: "strong" },
    { pattern: new RegExp(`^(?:${SECTION_WORDS})\\b[ \\t]*[:.\\-–—]?[ \\t]*.*$`, "i"), group: 0, kind: "strong" },
    { pattern: new RegExp(`^(?:part|book|volume|act)[ \\t]+(?:${ORDINAL})\\b.*$`, "i"), group: 0, kind: "strong" },
    { pattern: /^\d{1,4}[.)]?$/, group: 0, kind: "weak" },
    // Upper case only: lower-case roman letters spell too many ordinary words ("did", "mild").
    { pattern: /^[IVXLCDM]{1,12}[.)]?$/, group: 0, kind: "weak" }
];

/** Three or more repeated punctuation marks alone on a line: `* * *`, `---`, `~~~`, `• • •`. */
// Linear-time by construction: the old nested-quantifier form
// ((?:X+\s*){3,}) backtracked catastrophically on long near-miss lines.
const SEPARATOR_CHARS = /^[ \t]*[*\-–—_~•·][*\-–—_~•· \t]*$/;
const SEPARATOR_MAX_LINE = 200;
const SEPARATOR = {
    test: (line: string): boolean =>
        line.length <= SEPARATOR_MAX_LINE &&
        SEPARATOR_CHARS.test(line) &&
        (line.match(/[*\-–—_~•·]/g)?.length ?? 0) >= 3
};

const cleanTitle = (title: string): string =>
    title
        .replace(/^#+[ \t]*/, "")
        .replace(/[\s:]+$/, "")
        .trim();

const matchHeading = (line: string): Omit<DetectedHeading, "index"> | null => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > MAX_HEADING_LENGTH) return null;
    const matched = HEADING_PATTERNS.map(({ pattern, group, kind }) => {
        const title = pattern.exec(trimmed)?.[group];
        return title === undefined ? null : { title: cleanTitle(title), kind };
    }).find(candidate => candidate !== null);
    return matched ?? null;
};

const toLines = (text: string): string[] => text.replace(/\r\n?/g, "\n").split("\n");

/** Exported so the parser can tell a document's own title from its first chapter heading. */
export const detectHeadings = (text: string): DetectedHeading[] =>
    toLines(text).flatMap((line, index) => {
        const matched = matchHeading(line);
        return matched === null ? [] : [{ index, ...matched }];
    });

const fromHeadings = (lines: string[], headings: DetectedHeading[]): SplitChapter[] => {
    const sections = headings.map(({ index, title }, position) => ({
        title,
        body: lines.slice(index + 1, headings[position + 1]?.index ?? lines.length).join("\n")
    }));
    const preamble = lines.slice(0, headings[0].index).join("\n");
    return preamble.trim() ? [{ title: FRONT_MATTER_TITLE, body: preamble }, ...sections] : sections;
};

const meanWords = (bodies: string[]): number =>
    bodies.length === 0 ? 0 : bodies.reduce((total, body) => total + countWords(body), 0) / bodies.length;

/**
 * Scene separators only stand in for chapter breaks when nothing else was found and the
 * pieces are chapter-sized; inside a chapter the same marks divide scenes, not chapters.
 */
const fromSeparators = (lines: string[]): SplitChapter[] | null => {
    const breaks = lines.flatMap((line, index) => (SEPARATOR.test(line) ? [index] : []));
    if (breaks.length === 0) return null;

    const bounds = [-1, ...breaks, lines.length];
    const chunks = bounds
        .slice(0, -1)
        .map((start, position) => lines.slice(start + 1, bounds[position + 1]).join("\n"))
        .filter(chunk => chunk.trim());

    return chunks.length < 2 || meanWords(chunks) < SEPARATOR_MIN_MEAN_WORDS
        ? null
        : chunks.map(body => ({ title: "", body }));
};

type ChunkState = { chunks: string[][]; current: string[]; words: number };

/** Accumulate blank-line-separated paragraph groups up to a target size. */
const byLength = (text: string): SplitChapter[] => {
    if (countWords(text) <= SINGLE_CHAPTER_WORD_LIMIT) return [{ title: "", body: text }];

    const paragraphs = text.split(/\n[ \t]*\n+/).filter(paragraph => paragraph.trim());
    const { chunks, current } = paragraphs.reduce<ChunkState>(
        (accumulator, paragraph) => {
            const words = accumulator.words + countWords(paragraph);
            const current = [...accumulator.current, paragraph];
            return words >= TARGET_CHUNK_WORDS
                ? { chunks: [...accumulator.chunks, current], current: [], words: 0 }
                : { chunks: accumulator.chunks, current, words };
        },
        { chunks: [], current: [], words: 0 }
    );

    // A short tail joins the previous chunk rather than becoming a stub chapter.
    const tailIsStub = chunks.length > 0 && countWords(current.join("\n\n")) < MIN_TRAILING_CHUNK_WORDS;
    const grouped =
        current.length === 0
            ? chunks
            : tailIsStub
              ? [...chunks.slice(0, -1), [...chunks[chunks.length - 1], ...current]]
              : [...chunks, current];

    return grouped.map(group => ({ title: "", body: group.join("\n\n") }));
};

const finalise = (chapters: SplitChapter[]): SplitChapter[] =>
    chapters
        .map(({ title, body }) => ({ title: title.trim(), body: body.trim() }))
        .filter(({ body }) => body.length > 0)
        .map(({ title, body }, index) => ({ title: title || `Chapter ${index + 1}`, body }));

/** First heading set that is both present and credible, in precedence order. */
const chosenHeadings = (lines: string[], headings: DetectedHeading[]): SplitChapter[] | null => {
    const markdown = headings.filter(heading => heading.kind === "markdown");
    if (markdown.length > 0) return fromHeadings(lines, markdown);

    const strong = headings.filter(heading => heading.kind === "strong");
    if (strong.length > 0) return fromHeadings(lines, strong);
    if (headings.length === 0) return null;

    const weak = fromHeadings(lines, headings);
    return meanWords(weak.map(({ body }) => body)) < MIN_MEAN_SECTION_WORDS ? null : weak;
};

export const splitIntoChapters = (text: string): SplitChapter[] => {
    const lines = toLines(text);
    const chapters = chosenHeadings(lines, detectHeadings(text)) ?? fromSeparators(lines) ?? byLength(text);
    return finalise(chapters);
};
