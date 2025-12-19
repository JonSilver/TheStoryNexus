import { mergeRegister } from "@lexical/utils";
import { $getSelection, $isParagraphNode, $isRangeSelection, $isTextNode, getDOMSelection, type LexicalEditor } from "lexical";
import { useCallback, useEffect, useState } from "react";
import { getSelectedNode } from "../../utils/getSelectedNode";

interface FloatingToolbarState {
    isText: boolean;
    isBold: boolean;
    isItalic: boolean;
    isUnderline: boolean;
}

export const useFloatingTextFormatToolbar = (editor: LexicalEditor): FloatingToolbarState => {
    const [isText, setIsText] = useState(false);
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [isUnderline, setIsUnderline] = useState(false);

    const updatePopup = useCallback(() => {
        editor.getEditorState().read(() => {
            if (editor.isComposing()) return;

            const selection = $getSelection();
            const nativeSelection = getDOMSelection(editor._window);
            const rootElement = editor.getRootElement();

            if (
                nativeSelection !== null &&
                (!$isRangeSelection(selection) || rootElement === null || !rootElement.contains(nativeSelection.anchorNode))
            ) {
                setIsText(false);
                return;
            }

            if (!$isRangeSelection(selection)) return;

            const node = getSelectedNode(selection);

            setIsBold(selection.hasFormat("bold"));
            setIsItalic(selection.hasFormat("italic"));
            setIsUnderline(selection.hasFormat("underline"));

            if (selection.getTextContent() !== "") setIsText($isTextNode(node) || $isParagraphNode(node));
            else setIsText(false);

            const rawTextContent = selection.getTextContent().replace(/\n/g, "");
            if (!selection.isCollapsed() && rawTextContent === "") {
                setIsText(false);
                return;
            }
        });
    }, [editor]);

    useEffect(() => {
        document.addEventListener("selectionchange", updatePopup);

        const handleTouchEnd = () => {
            setTimeout(updatePopup, 100);
        };
        document.addEventListener("touchend", handleTouchEnd);

        return () => {
            document.removeEventListener("selectionchange", updatePopup);
            document.removeEventListener("touchend", handleTouchEnd);
        };
    }, [updatePopup]);

    useEffect(
        () =>
            mergeRegister(
                editor.registerUpdateListener(() => {
                    updatePopup();
                }),
                editor.registerRootListener(() => {
                    if (editor.getRootElement() === null) setIsText(false);
                })
            ),
        [editor, updatePopup]
    );

    return { isText, isBold, isItalic, isUnderline };
};
