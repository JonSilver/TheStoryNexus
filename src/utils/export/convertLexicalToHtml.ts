import type { LexicalEditorState, SerializedLexicalNode } from "./types";

/**
 * Converts Lexical JSON content to HTML
 * @param jsonContent The Lexical JSON content string
 * @returns HTML string representation of the content
 */

export async function convertLexicalToHtml(jsonContent: string): Promise<string> {
    const editorState: LexicalEditorState = JSON.parse(jsonContent);
    const container = document.createElement("div");

    const processNode = (node: SerializedLexicalNode, parentElement: HTMLElement): void => {
        if (node.type === "text" && node.text) {
            const textNode = document.createTextNode(node.text);
            parentElement.appendChild(textNode);
        } else if (node.type === "paragraph") {
            const p = document.createElement("p");
            if (node.children) node.children.forEach(child => processNode(child, p));

            parentElement.appendChild(p);
        } else if (node.type === "heading" && node.tag) {
            const headingTag = `h${node.tag}`;
            const heading = document.createElement(headingTag);
            if (node.children) node.children.forEach(child => processNode(child, heading));

            parentElement.appendChild(heading);
        } else if (node.children) node.children.forEach(child => processNode(child, parentElement));
    };

    if (editorState.root?.children) editorState.root.children.forEach(node => processNode(node, container));

    return container.innerHTML;
}
