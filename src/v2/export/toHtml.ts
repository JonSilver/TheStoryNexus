/**
 * Intermediate blocks -> semantic XHTML-safe HTML (v2 contracts §3).
 *
 * Every text node and every attribute value is escaped; nothing is interpolated raw.
 * This output feeds the EPUB writer, so void elements are self-closed.
 */
import {
    type Block,
    type BlockRenderers,
    type Inline,
    type InlineText,
    type ListBlock,
    type ListItem,
    type Mark,
    renderWith
} from "./blocks";

const TEXT_ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
const ATTRIBUTE_ENTITIES: Record<string, string> = { ...TEXT_ENTITIES, '"': "&quot;", "'": "&#39;" };

const escapeWith = (entities: Record<string, string>, pattern: RegExp) => (value: string) =>
    value.replace(pattern, character => entities[character]);

export const escapeHtmlText = escapeWith(TEXT_ENTITIES, /[&<>]/g);
export const escapeHtmlAttribute = escapeWith(ATTRIBUTE_ENTITIES, /[&<>"']/g);

/** Innermost first, so bold+italic+underline reads `<strong><em><u>x</u></em></strong>`. */
const MARK_TAGS: readonly { mark: Mark; tag: string }[] = [
    { mark: "underline", tag: "u" },
    { mark: "italic", tag: "em" },
    { mark: "bold", tag: "strong" }
];

const renderRun = (run: InlineText) =>
    MARK_TAGS.reduce(
        (wrapped, { mark, tag }) => (run.marks.includes(mark) ? `<${tag}>${wrapped}</${tag}>` : wrapped),
        escapeHtmlText(run.text)
    );

const renderInline = (content: Inline[]) =>
    content.map(item => (item.type === "text" ? renderRun(item) : "<br />")).join("");

const INDENT = "    ";

const indentLines = (lines: string[], depth: number) => lines.map(line => `${INDENT.repeat(depth)}${line}`);

const LIST_TAGS: Record<ListBlock["type"], string> = { bulletList: "ul", orderedList: "ol" };

const listOpenTag = (list: ListBlock) => {
    const tag = LIST_TAGS[list.type];
    const start =
        list.type === "orderedList" && list.start !== 1 ? ` start="${escapeHtmlAttribute(String(list.start))}"` : "";
    return `<${tag}${start}>`;
};

const renderItemLines = (item: ListItem): string[] => {
    const body = renderInline(item.content).trim();
    const nested = item.children.flatMap(renderListLines);
    if (!nested.length) return [`<li>${body}</li>`];
    return [`<li>${body}`, ...indentLines(nested, 1), "</li>"];
};

const renderListLines = (list: ListBlock): string[] => [
    listOpenTag(list),
    ...indentLines(list.items.flatMap(renderItemLines), 1),
    `</${LIST_TAGS[list.type]}>`
];

const renderList = (list: ListBlock) => (list.items.length ? renderListLines(list).join("\n") : null);

const renderImage = (src: string, alt: string) =>
    `<img src="${escapeHtmlAttribute(src)}" alt="${escapeHtmlAttribute(alt)}" />`;

/** `null` means "emit nothing" — scene beats in every status (§2) and empty blocks. */
const HTML_BLOCKS: BlockRenderers<string | null> = {
    paragraph: block => {
        const body = renderInline(block.content).trim();
        return body ? `<p>${body}</p>` : null;
    },
    heading: block => {
        const body = renderInline(block.content).trim();
        return body ? `<h${block.level}>${body}</h${block.level}>` : null;
    },
    bulletList: renderList,
    orderedList: renderList,
    horizontalRule: () => "<hr />",
    image: block =>
        block.caption
            ? [
                  "<figure>",
                  `${INDENT}${renderImage(block.src, block.alt)}`,
                  `${INDENT}<figcaption>${escapeHtmlText(block.caption)}</figcaption>`,
                  "</figure>"
              ].join("\n")
            : renderImage(block.src, block.alt),
    sceneBeat: () => null
};

export const blocksToHtml = (blocks: Block[]): string =>
    blocks
        .map(block => renderWith(HTML_BLOCKS, block))
        .filter((rendered): rendered is string => rendered !== null)
        .join("\n");
