/**
 * Serialised Lexical editor-state JSON -> typed intermediate block list (v2 contracts §1).
 *
 * Deliberately consumes the serialised JSON rather than a live editor, so export runs
 * server-side with no Lexical runtime. Unknown node types degrade to their inline text
 * rather than being dropped.
 */
import { attempt } from "@jfdi/attempt";

export type Mark = "bold" | "italic" | "underline";

export type InlineText = { type: "text"; text: string; marks: Mark[] };
export type InlineLineBreak = { type: "lineBreak" };
export type Inline = InlineText | InlineLineBreak;

export type ListItem = { content: Inline[]; children: ListBlock[] };

export type ParagraphBlock = { type: "paragraph"; content: Inline[] };
export type HeadingBlock = { type: "heading"; level: 1 | 2 | 3; content: Inline[] };
/** Split rather than a union discriminant so `Extract<Block, { type: K }>` narrows per key. */
export type BulletListBlock = { type: "bulletList"; start: number; items: ListItem[] };
export type OrderedListBlock = { type: "orderedList"; start: number; items: ListItem[] };
export type ListBlock = BulletListBlock | OrderedListBlock;
export type HorizontalRuleBlock = { type: "horizontalRule" };
export type ImageBlock = { type: "image"; src: string; alt: string; caption?: string };
export type SceneBeatBlock = {
    type: "sceneBeat";
    command: string;
    status: "idle" | "generating" | "done";
    generatedText: string;
    collapsed: boolean;
    povCharacter?: string;
    povType?: string;
};

export type Block = ParagraphBlock | HeadingBlock | ListBlock | HorizontalRuleBlock | ImageBlock | SceneBeatBlock;

/** Renderer table shape shared by every target: exhaustive over Block["type"], narrowed per key. */
export type BlockRenderers<T> = { [K in Block["type"]]: (block: Extract<Block, { type: K }>) => T };

export const renderWith = <T>(renderers: BlockRenderers<T>, block: Block): T =>
    (renderers[block.type] as (b: Block) => T)(block);

export type LexicalNode = { type?: string; children?: LexicalNode[]; [key: string]: unknown };
export type EditorStateJson = { root?: LexicalNode };

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const asNumber = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;

/** Lexical TextNode format bitmask (verified against lexical's IS_BOLD/IS_ITALIC/IS_UNDERLINE). */
const FORMAT_MARKS: readonly { bit: number; mark: Mark }[] = [
    { bit: 1, mark: "bold" },
    { bit: 2, mark: "italic" },
    { bit: 8, mark: "underline" }
];

const marksOf = (format: unknown): Mark[] =>
    FORMAT_MARKS.filter(({ bit }) => (asNumber(format, 0) & bit) !== 0).map(({ mark }) => mark);

const INLINE_PARSERS: Record<string, (node: LexicalNode) => Inline[]> = {
    text: node => {
        const text = asString(node.text);
        return text ? [{ type: "text", text, marks: marksOf(node.format) }] : [];
    },
    linebreak: () => [{ type: "lineBreak" }],
    tab: () => [{ type: "text", text: "\t", marks: [] }],
    // A beat nested inside prose still contributes nothing (§2).
    "scene-beat": () => []
};

const parseInline = (node: LexicalNode): Inline[] => (INLINE_PARSERS[asString(node.type)] ?? parseInlineChildren)(node);

const parseInlineChildren = (node: LexicalNode): Inline[] => (node.children ?? []).flatMap(parseInline);

/** §1 permits levels 1-3 only; deeper Lexical headings clamp rather than vanish. */
const HEADING_LEVELS: Record<string, 1 | 2 | 3> = { h1: 1, h2: 2, h3: 3, h4: 3, h5: 3, h6: 3 };

const LIST_TYPES: Record<string, ListBlock["type"]> = {
    bullet: "bulletList",
    check: "bulletList",
    number: "orderedList",
    ul: "bulletList",
    ol: "orderedList"
};

const listKindOf = (node: LexicalNode): ListBlock["type"] =>
    LIST_TYPES[asString(node.listType)] ?? LIST_TYPES[asString(node.tag)] ?? "bulletList";

const isList = (node: LexicalNode) => asString(node.type) === "list";

const parseListItem = (node: LexicalNode): ListItem => {
    const children = node.children ?? [];
    return {
        content: children.filter(child => !isList(child)).flatMap(parseInline),
        children: children.filter(isList).map(parseList)
    };
};

const parseList = (node: LexicalNode): ListBlock => ({
    type: listKindOf(node),
    start: asNumber(node.start, 1),
    items: (node.children ?? []).filter(child => asString(child.type) === "listitem").map(parseListItem)
});

const SCENE_BEAT_STATUSES: readonly SceneBeatBlock["status"][] = ["idle", "generating", "done"];

const parseSceneBeat = (node: LexicalNode): SceneBeatBlock => {
    const status = SCENE_BEAT_STATUSES.find(candidate => candidate === node.status) ?? "idle";
    const povCharacter = asString(node.povCharacter);
    const povType = asString(node.povType);
    return {
        type: "sceneBeat",
        command: asString(node.command),
        status,
        generatedText: asString(node.generatedText),
        collapsed: node.collapsed === true,
        ...(povCharacter ? { povCharacter } : {}),
        ...(povType ? { povType } : {})
    };
};

const parseImage = (node: LexicalNode): ImageBlock | null => {
    const src = asString(node.src);
    // Contract §1/§4: image src must be a server asset URL. Enforced here so
    // no exporter (including server-side EPUB, which FETCHES image URLs) can
    // be steered at arbitrary or internal addresses by crafted content.
    if (!src.startsWith("/api/assets/")) return null;
    const caption = asString(node.caption);
    return {
        type: "image",
        src,
        alt: asString(node.alt) || asString(node.altText),
        ...(caption ? { caption } : {})
    };
};

const BLOCK_PARSERS: Record<string, (node: LexicalNode) => Block | null> = {
    paragraph: node => ({ type: "paragraph", content: parseInlineChildren(node) }),
    heading: node => ({
        type: "heading",
        level: HEADING_LEVELS[asString(node.tag)] ?? 1,
        content: parseInlineChildren(node)
    }),
    list: parseList,
    horizontalrule: () => ({ type: "horizontalRule" }),
    image: parseImage,
    "scene-beat": parseSceneBeat,
    "scene-beat-v2": parseSceneBeat,
    // Provisional continuations are not manuscript
    "suggestion-v2": () => null
};

/** Unknown blocks keep their prose: serialise inline descendants as a paragraph. */
const parseBlock = (node: LexicalNode): Block | null =>
    (BLOCK_PARSERS[asString(node.type)] ?? (unknown => ({ type: "paragraph", content: parseInlineChildren(unknown) })))(
        node
    );

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

export const parseEditorState = (state: EditorStateJson): Block[] => {
    if (!isRecord(state)) throw new Error("Invalid document: expected an editor-state object");
    const root = state.root;
    if (!isRecord(root)) throw new Error('Invalid document: missing "root" node');
    if (!Array.isArray(root.children)) throw new Error('Invalid document: "root.children" must be an array');
    return root.children
        .filter(isRecord)
        .map(parseBlock)
        .filter((block): block is Block => block !== null);
};

export const parseSerialisedDocument = (json: string): Block[] => {
    const [error, state] = attempt<EditorStateJson>(() => JSON.parse(json));
    if (error) throw new Error(`Invalid document JSON: ${(error as Error).message}`);
    return parseEditorState(state);
};
