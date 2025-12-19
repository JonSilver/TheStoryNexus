import { addClassNamesToElement } from "@lexical/utils";
import type { EditorConfig, SerializedTextNode } from "lexical";
import { $applyNodeReplacement, TextNode } from "lexical";

/** @noInheritDoc */
export class SpecialTextNode extends TextNode {
    static getType(): string {
        return "specialText";
    }

    static clone(node: SpecialTextNode): SpecialTextNode {
        return new SpecialTextNode(node.__text, node.__key);
    }

    createDOM(config: EditorConfig): HTMLElement {
        const dom = document.createElement("span");
        addClassNamesToElement(dom, config.theme.specialText);
        dom.textContent = this.getTextContent();
        return dom;
    }

    updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
        if (prevNode.__text.startsWith("[") && prevNode.__text.endsWith("]")) {
            const strippedText = this.__text.substring(1, this.__text.length - 1); // Strip brackets again
            dom.textContent = strippedText; // Update the text content
        }

        addClassNamesToElement(dom, config.theme.specialText);

        return false;
    }

    static importJSON(serializedNode: SerializedTextNode): SpecialTextNode {
        return $createSpecialTextNode().updateFromJSON(serializedNode);
    }

    isTextEntity(): true {
        return true;
    }
    canInsertTextAfter(): boolean {
        return false; // Prevents appending text to this node
    }
}

const $createSpecialTextNode = (text = ""): SpecialTextNode => $applyNodeReplacement(new SpecialTextNode(text));
