import {
    $createParagraphNode,
    $isElementNode,
    type DOMConversionMap,
    type DOMConversionOutput,
    type EditorConfig,
    ElementNode,
    type LexicalEditor,
    type LexicalNode,
    type RangeSelection,
    type SerializedElementNode
} from "lexical";
import { IS_CHROME } from "@/components/story-editor/shared/environment";
import invariant from "@/components/story-editor/shared/invariant";
import { $isCollapsibleContainerNode } from "./CollapsibleContainerNode";
import { $isCollapsibleContentNode } from "./CollapsibleContentNode";

type SerializedCollapsibleTitleNode = SerializedElementNode;

function $convertSummaryElement(_domNode: HTMLElement): DOMConversionOutput | null {
    const node = $createCollapsibleTitleNode();
    return {
        node
    };
}

export class CollapsibleTitleNode extends ElementNode {
    static getType(): string {
        return "collapsible-title";
    }

    static clone(node: CollapsibleTitleNode): CollapsibleTitleNode {
        return new CollapsibleTitleNode(node.__key);
    }

    createDOM(_config: EditorConfig, editor: LexicalEditor): HTMLElement {
        const dom = document.createElement("summary");
        dom.classList.add("Collapsible__title");
        if (IS_CHROME)
            dom.addEventListener("click", () => {
                editor.update(() => {
                    const collapsibleContainer = this.getLatest().getParentOrThrow();
                    invariant(
                        $isCollapsibleContainerNode(collapsibleContainer),
                        "Expected parent node to be a CollapsibleContainerNode"
                    );
                    collapsibleContainer.toggleOpen();
                });
            });

        return dom;
    }

    updateDOM(_prevNode: this, _dom: HTMLElement): boolean {
        return false;
    }

    static importDOM(): DOMConversionMap | null {
        return {
            summary: (_domNode: HTMLElement) => ({
                conversion: $convertSummaryElement,
                priority: 1
            })
        };
    }

    static importJSON(serializedNode: SerializedCollapsibleTitleNode): CollapsibleTitleNode {
        return $createCollapsibleTitleNode().updateFromJSON(serializedNode);
    }

    collapseAtStart(_selection: RangeSelection): boolean {
        this.getParentOrThrow().insertBefore(this);
        return true;
    }

    static transform(): (node: LexicalNode) => void {
        return (node: LexicalNode) => {
            invariant($isCollapsibleTitleNode(node), "node is not a CollapsibleTitleNode");
            if (node.isEmpty()) node.remove();
        };
    }

    insertNewAfter(_: RangeSelection, restoreSelection = true): ElementNode {
        const containerNode = this.getParentOrThrow();

        if (!$isCollapsibleContainerNode(containerNode))
            throw new Error("CollapsibleTitleNode expects to be child of CollapsibleContainerNode");

        if (containerNode.getOpen()) {
            const contentNode = this.getNextSibling();
            if (!$isCollapsibleContentNode(contentNode))
                throw new Error("CollapsibleTitleNode expects to have CollapsibleContentNode sibling");

            const firstChild = contentNode.getFirstChild();
            if ($isElementNode(firstChild)) return firstChild;
            else {
                const paragraph = $createParagraphNode();
                contentNode.append(paragraph);
                return paragraph;
            }
        } else {
            const paragraph = $createParagraphNode();
            containerNode.insertAfter(paragraph, restoreSelection);
            return paragraph;
        }
    }
}

export function $createCollapsibleTitleNode(): CollapsibleTitleNode {
    return new CollapsibleTitleNode();
}

export function $isCollapsibleTitleNode(node: LexicalNode | null | undefined): node is CollapsibleTitleNode {
    return node instanceof CollapsibleTitleNode;
}
