/**
 * Intermediate blocks -> prose plain text (v2 contracts §3): the AI-context feed and the
 * PDF layout base. Markup, images, horizontal rules and scene beats contribute nothing;
 * list structure survives as indentation rather than markers.
 */
import { type Block, type BlockRenderers, type Inline, type ListBlock, renderWith } from "./blocks.js";

const renderInline = (content: Inline[]) => content.map(item => (item.type === "text" ? item.text : "\n")).join("");

const LIST_INDENT = "  ";

const renderListLines = (list: ListBlock, depth: number): string[] =>
    list.items.flatMap(item => {
        const body = renderInline(item.content).trim();
        const nested = item.children.flatMap(child => renderListLines(child, depth + 1));
        return body ? [`${LIST_INDENT.repeat(depth)}${body}`, ...nested] : nested;
    });

const renderList = (list: ListBlock) => renderListLines(list, 0).join("\n") || null;

const PLAIN_TEXT_BLOCKS: BlockRenderers<string | null> = {
    paragraph: block => renderInline(block.content).trim() || null,
    heading: block => renderInline(block.content).trim() || null,
    bulletList: renderList,
    orderedList: renderList,
    horizontalRule: () => null,
    image: () => null,
    sceneBeat: () => null
};

export const blocksToPlainText = (blocks: Block[]): string =>
    blocks
        .map(block => renderWith(PLAIN_TEXT_BLOCKS, block))
        .filter((rendered): rendered is string => rendered !== null)
        .join("\n\n");
