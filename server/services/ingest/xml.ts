/**
 * Minimal XML/XHTML text extraction for manuscript ingestion (Phase 7).
 *
 * Deliberately regex-based rather than a parser dependency: EPUB OPF files and DOCX
 * metadata are machine-generated and well-formed, and the only thing wanted from
 * chapter XHTML is its prose. Nothing here is used to render untrusted markup.
 */

const NAMED_ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    ensp: " ",
    emsp: " ",
    thinsp: " ",
    shy: "",
    mdash: "—",
    ndash: "–",
    hellip: "…",
    lsquo: "‘",
    rsquo: "’",
    ldquo: "“",
    rdquo: "”",
    laquo: "«",
    raquo: "»",
    middot: "·",
    bull: "•"
};

const codePointOf = (body: string): string | null => {
    const code =
        body[1]?.toLowerCase() === "x" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
};

export const decodeEntities = (value: string): string =>
    value.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, (match, body: string) =>
        body.startsWith("#") ? (codePointOf(body) ?? match) : (NAMED_ENTITIES[body.toLowerCase()] ?? match)
    );

/** Tags whose boundaries are prose boundaries; everything else is inline and vanishes silently. */
const BLOCK_TAGS =
    "p|div|br|h[1-6]|li|ul|ol|tr|td|th|section|article|aside|blockquote|hr|pre|figure|figcaption|header|footer|nav|title";

const BLOCK_TAG_PATTERN = new RegExp(`</?(?:${BLOCK_TAGS})\\b[^>]*>`, "gi");

export const xhtmlToText = (xhtml: string): string =>
    decodeEntities(
        xhtml
            .replace(/<!--[\s\S]*?-->/g, "")
            .replace(/<\?[\s\S]*?\?>/g, "")
            .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
            .replace(/<(script|style|head)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
            .replace(BLOCK_TAG_PATTERN, "\n")
            .replace(/<[^>]*>/g, "")
    )
        .replace(/\r\n?/g, "\n")
        .replace(/[ \t\u00a0]+/g, " ")
        .replace(/ *\n */g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

/** Namespace-tolerant: `tagText(opf, "title")` finds `<dc:title>`. */
export const tagText = (xml: string, tagName: string): string => {
    const match = new RegExp(`<(?:[\\w-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tagName}>`, "i").exec(xml);
    return match ? decodeEntities(match[1].replace(/<[^>]*>/g, "")).trim() : "";
};

/** Opening (or self-closing) tags of `tagName`, in document order, as raw strings. */
export const openingTags = (xml: string, tagName: string): string[] =>
    [...xml.matchAll(new RegExp(`<(?:[\\w-]+:)?${tagName}\\b[^>]*?/?>`, "gi"))].map(match => match[0]);

export const attributesOf = (tag: string): Record<string, string> =>
    Object.fromEntries(
        [...tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(match => [
            match[1].replace(/^[\w-]+:/, ""),
            decodeEntities(match[2] ?? match[3] ?? "")
        ])
    );
