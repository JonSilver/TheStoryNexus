import { $isListNode, ListNode } from "@lexical/list";
import { $isHeadingNode } from "@lexical/rich-text";
import { $getSelectionStyleValueForProperty, $isParentElementRTL } from "@lexical/selection";
import { $isTableNode, $isTableSelection } from "@lexical/table";
import { $findMatchingParent, $getNearestNodeOfType, $isEditorIsNestedEditor } from "@lexical/utils";
import { $getSelection, $isElementNode, $isRangeSelection, $isRootOrShadowRoot, type LexicalEditor } from "lexical";
import { useCallback } from "react";
import { blockTypeToBlockName, type UpdateToolbarState } from "../../context/ToolbarContext";
import { getSelectedNode } from "../../utils/getSelectedNode";

export const useToolbarUpdate = (
    editor: LexicalEditor,
    activeEditor: LexicalEditor,
    updateToolbarState: UpdateToolbarState
) =>
    useCallback(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            if (activeEditor !== editor && $isEditorIsNestedEditor(activeEditor)) {
                const rootElement = activeEditor.getRootElement();
                updateToolbarState(
                    "isImageCaption",
                    !!rootElement?.parentElement?.classList.contains("image-caption-container")
                );
            } else updateToolbarState("isImageCaption", false);

            const anchorNode = selection.anchor.getNode();
            let element =
                anchorNode.getKey() === "root"
                    ? anchorNode
                    : $findMatchingParent(anchorNode, e => {
                          const parent = e.getParent();
                          return parent !== null && $isRootOrShadowRoot(parent);
                      });

            if (element === null) element = anchorNode.getTopLevelElementOrThrow();

            const elementKey = element.getKey();
            const elementDOM = activeEditor.getElementByKey(elementKey);

            updateToolbarState("isRTL", $isParentElementRTL(selection));

            const node = getSelectedNode(selection);
            const parent = node.getParent();

            const tableNode = $findMatchingParent(node, $isTableNode);
            if ($isTableNode(tableNode)) updateToolbarState("rootType", "table");
            else updateToolbarState("rootType", "root");

            if (elementDOM !== null)
                if ($isListNode(element)) {
                    const parentList = $getNearestNodeOfType<ListNode>(anchorNode, ListNode);
                    const type = parentList ? parentList.getListType() : element.getListType();
                    updateToolbarState("blockType", type);
                } else {
                    const type = $isHeadingNode(element) ? element.getTag() : element.getType();
                    if (type in blockTypeToBlockName)
                        updateToolbarState("blockType", type as keyof typeof blockTypeToBlockName);
                }

            updateToolbarState("fontColor", $getSelectionStyleValueForProperty(selection, "color", "#000"));
            updateToolbarState("bgColor", $getSelectionStyleValueForProperty(selection, "background-color", "#fff"));
            updateToolbarState("fontFamily", $getSelectionStyleValueForProperty(selection, "font-family", "Arial"));
            const matchingParent = $findMatchingParent(
                node,
                parentNode => $isElementNode(parentNode) && !parentNode.isInline()
            );

            updateToolbarState(
                "elementFormat",
                $isElementNode(matchingParent)
                    ? matchingParent.getFormatType()
                    : $isElementNode(node)
                      ? node.getFormatType()
                      : parent?.getFormatType() || "left"
            );
        }
        if ($isRangeSelection(selection) || $isTableSelection(selection)) {
            updateToolbarState("isBold", selection.hasFormat("bold"));
            updateToolbarState("isItalic", selection.hasFormat("italic"));
            updateToolbarState("isUnderline", selection.hasFormat("underline"));
            updateToolbarState("isStrikethrough", selection.hasFormat("strikethrough"));
            updateToolbarState("isSubscript", selection.hasFormat("subscript"));
            updateToolbarState("isSuperscript", selection.hasFormat("superscript"));
            updateToolbarState("fontSize", $getSelectionStyleValueForProperty(selection, "font-size", "15px"));
            updateToolbarState("isLowercase", selection.hasFormat("lowercase"));
            updateToolbarState("isUppercase", selection.hasFormat("uppercase"));
            updateToolbarState("isCapitalize", selection.hasFormat("capitalize"));
        }
    }, [activeEditor, editor, updateToolbarState]);
