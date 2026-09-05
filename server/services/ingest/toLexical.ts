/**
 * Chapter body (plain text with light markdown) -> serialised v2 Lexical editor state.
 *
 * Emits only the node shapes the v2 export pipeline understands (see src/v2/export/blocks.ts):
 * paragraphs, h1-h3 headings and horizontal rules. Inline emphasis is deliberately left as
 * literal characters — an importer that guesses at emphasis corrupts prose that meant the
 * asterisks. Source line breaks inside a paragraph are preserved as linebreak nodes, so the
 * document round-trips back to its input text rather than being silently reflowed.
 */

type LexicalNode = Record<string, unknown>;

const MAX_HEADING_LEVEL = 3;

const HEADING_TAGS: Record<number, string> = { 1: "h1", 2: "h2", 3: "h3" };

const textNode = (text: string): LexicalNode => ({
    detail: 0,
    format: 0,
    mode: "normal",
    style: "",
    text,
    type: "text",
    version: 1
});

const lineBreakNode = (): LexicalNode => ({ type: "linebreak", version: 1 });

const element = (type: string, children: LexicalNode[], extra: Record<string, unknown> = {}): LexicalNode => ({
    children,
    direction: null,
    format: "",
    indent: 0,
    type,
    version: 1,
    ...extra
});

const inlineChildren = (lines: string[]): LexicalNode[] =>
    lines.flatMap((line, index) => (index === 0 ? [textNode(line)] : [lineBreakNode(), textNode(line)]));

const paragraph = (lines: string[]): LexicalNode =>
    element("paragraph", inlineChildren(lines), { textFormat: 0, textStyle: "" });

const heading = (hashes: string, text: string): LexicalNode =>
    element("heading", [textNode(text)], { tag: HEADING_TAGS[Math.min(hashes.length, MAX_HEADING_LEVEL)] });

/** Lines that are a block in their own right, ending any paragraph in progress. */
const STANDALONE_LINES: readonly { pattern: RegExp; node: (match: RegExpExecArray) => LexicalNode }[] = [
    { pattern: /^(#{1,6})[ \t]+(.+?)[ \t]*#*$/, node: match => heading(match[1], match[2]) },
    { pattern: /^(?:-{3,}|\*{3,}|_{3,})$/, node: () => ({ type: "horizontalrule", version: 1 }) }
];

const standaloneNode = (line: string): LexicalNode | null => {
    const matched = STANDALONE_LINES.map(({ pattern, node }) => {
        const match = pattern.exec(line);
        return match === null ? null : node(match);
    }).find(candidate => candidate !== null);
    return matched ?? null;
};

type BuildState = { blocks: LexicalNode[]; buffer: string[] };

const flushed = ({ blocks, buffer }: BuildState): LexicalNode[] =>
    buffer.length > 0 ? [...blocks, paragraph(buffer)] : blocks;

const consume = (state: BuildState, rawLine: string): BuildState => {
    const line = rawLine.trim();
    if (!line) return { blocks: flushed(state), buffer: [] };
    const standalone = standaloneNode(line);
    return standalone
        ? { blocks: [...flushed(state), standalone], buffer: [] }
        : { blocks: state.blocks, buffer: [...state.buffer, line] };
};

export const toLexicalDocument = (body: string): string => {
    const state = body
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .reduce<BuildState>(consume, { blocks: [], buffer: [] });
    const blocks = flushed(state);
    return JSON.stringify({
        root: element("root", blocks.length > 0 ? blocks : [paragraph([])])
    });
};
