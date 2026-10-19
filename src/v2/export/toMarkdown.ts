/** Intermediate blocks -> Markdown (v2 contracts §3). */
import {
    type Block,
    type BlockRenderers,
    type Inline,
    type InlineText,
    type ListBlock,
    type Mark,
    renderWith
} from "./blocks.js";

/** Innermost wrapper first, so bold+italic+underline reads `***<u>x</u>***`. */
const MARK_WRAPPERS: readonly { mark: Mark; open: string; close: string }[] = [
    { mark: "underline", open: "<u>", close: "</u>" },
    { mark: "italic", open: "*", close: "*" },
    { mark: "bold", open: "**", close: "**" }
];

/**
 * Deliberately light: only characters that would be read as inline markup. Apostrophes,
 * quotes and punctuation stay untouched so prose survives readably. `#` matters only where
 * a line begins, so it is escaped there alone.
 */
const escapeText = (text: string) => text.replace(/([\\`*_[\]])/g, "\\$1");

const escapeLeadingHashes = (text: string) => text.replace(/(^|\n)([ \t]*)#/g, "$1$2\\#");

const renderRun = (run: InlineText) =>
    MARK_WRAPPERS.reduce(
        (wrapped, { mark, open, close }) => (run.marks.includes(mark) ? `${open}${wrapped}${close}` : wrapped),
        escapeText(run.text)
    );

const HARD_BREAK = "  \n";

const renderInline = (content: Inline[]) =>
    content.map(item => (item.type === "text" ? renderRun(item) : HARD_BREAK)).join("");

const renderProse = (content: Inline[]) => escapeLeadingHashes(renderInline(content).trimEnd());

const LIST_INDENT = "    ";

const LIST_MARKERS: Record<ListBlock["type"], (ordinal: number, start: number) => string> = {
    bulletList: () => "-",
    orderedList: (ordinal, start) => `${start + ordinal}.`
};

const indentContinuation = (body: string, pad: string) =>
    body
        .split("\n")
        .map((line, index) => (index === 0 ? line : `${pad}${line}`))
        .join("\n");

const renderListLines = (list: ListBlock, depth: number): string[] =>
    list.items.reduce<{ lines: string[]; ordinal: number }>(
        (acc, item) => {
            const nested = item.children.flatMap(child => renderListLines(child, depth + 1));
            const body = renderProse(item.content);
            // A Lexical wrapper item holds only a nested list: emit the nesting, not a marker.
            if (!body) return { ...acc, lines: [...acc.lines, ...nested] };
            const marker = LIST_MARKERS[list.type](acc.ordinal, list.start);
            const indent = LIST_INDENT.repeat(depth);
            const line = `${indent}${marker} ${indentContinuation(body, `${indent}${" ".repeat(marker.length + 1)}`)}`;
            return { lines: [...acc.lines, line, ...nested], ordinal: acc.ordinal + 1 };
        },
        { lines: [], ordinal: 0 }
    ).lines;

const renderList = (list: ListBlock) => renderListLines(list, 0).join("\n") || null;

/** URLs containing whitespace or parens need angle-bracket form to survive a Markdown parser. */
const renderSrc = (src: string) => (/[\s()<>]/.test(src) ? `<${src.replace(/([<>])/g, "\\$1")}>` : src);

const renderTitle = (caption?: string) => (caption ? ` "${caption.replace(/(["\\])/g, "\\$1")}"` : "");

/** `null` means "emit nothing" — scene beats in every status (§2), empty paragraphs, empty lists. */
const MARKDOWN_BLOCKS: BlockRenderers<string | null> = {
    paragraph: block => renderProse(block.content) || null,
    heading: block => {
        const body = renderInline(block.content).trim();
        return body ? `${"#".repeat(block.level)} ${body}` : null;
    },
    bulletList: renderList,
    orderedList: renderList,
    horizontalRule: () => "---",
    image: block => `![${escapeText(block.alt)}](${renderSrc(block.src)}${renderTitle(block.caption)})`,
    sceneBeat: () => null
};

export const blocksToMarkdown = (blocks: Block[]): string =>
    blocks
        .map(block => renderWith(MARKDOWN_BLOCKS, block))
        .filter((rendered): rendered is string => rendered !== null)
        .join("\n\n");
