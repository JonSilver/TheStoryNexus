import { $createParagraphNode, $createTextNode, $getRoot, type LexicalNode, type ParagraphNode } from "lexical";

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
