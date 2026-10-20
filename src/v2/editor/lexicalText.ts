import {
    $createParagraphNode,
    $createTextNode,
    $getRoot,
    $getSelection,
    $isRangeSelection,
    type LexicalNode,
    type NodeKey,
    type ParagraphNode,
    type RangeSelection
} from "lexical";

/** The most preceding prose a request carries; the server's token budgeting trims further. */
const RECENT_PROSE_CHAR_CAP = 100_000;

/** The manuscript before a top-level node (the whole of it for null), blocks separated by blank lines. */
export const $textBefore = (nodeKey: NodeKey | null): string => {
    const children = $getRoot().getChildren();
    const end = nodeKey === null ? children.length : children.findIndex(child => child.getKey() === nodeKey);
    return children
        .slice(0, end < 0 ? children.length : end)
        .map(child => child.getTextContent())
        .join("\n\n")
        .slice(-RECENT_PROSE_CHAR_CAP);
};

/** The selected text with a copy of the selection to act on later, or null when nothing is selected. */
export const $captureSelection = (): { text: string; selection: RangeSelection } | null => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || selection.isCollapsed()) return null;
    return { text: selection.getTextContent(), selection: selection.clone() };
};

/** Generated prose as paragraphs: blank lines separate them; empty ones are dropped. */
const $paragraphsFromText = (text: string): ParagraphNode[] =>
    text
        .split(/\n{2,}/)
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => $createParagraphNode().append($createTextNode(p)));

/** Inserts the text as paragraphs straight after `anchor`, caret at the end of the last. */
export const $insertParagraphsAfter = (anchor: LexicalNode, text: string): ParagraphNode[] => {
    const paragraphs = $paragraphsFromText(text);
    paragraphs.reduce<LexicalNode>((previous, paragraph) => {
        previous.insertAfter(paragraph);
        return paragraph;
    }, anchor);
    paragraphs[paragraphs.length - 1]?.selectEnd();
    return paragraphs;
};

/** Appends the text as paragraphs at the end of the document, caret at the end. */
export const $appendParagraphs = (text: string): void => {
    const paragraphs = $paragraphsFromText(text);
    $getRoot().append(...paragraphs);
    paragraphs[paragraphs.length - 1]?.selectEnd();
};

/**
 * Replaces the selection with prose: blank lines start new paragraphs (as
 * pressing Enter would). insertText keeps the replaced text's formatting
 * (an italic thought stays italic).
 */
export const $replaceSelectionWithProse = (selection: RangeSelection, text: string): void => {
    const blocks = text
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(Boolean);
    blocks.forEach((block, index) => {
        if (index > 0) selection.insertParagraph();
        selection.insertText(block);
    });
};
