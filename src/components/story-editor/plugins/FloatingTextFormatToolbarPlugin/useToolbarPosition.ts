import { mergeRegister } from "@lexical/utils";
import { $getSelection, COMMAND_PRIORITY_LOW, getDOMSelection, type LexicalEditor, SELECTION_CHANGE_COMMAND } from "lexical";
import { type RefObject, useCallback, useEffect } from "react";
import { getDOMRangeRect } from "../../utils/getDOMRangeRect";
import { setFloatingElemPosition } from "../../utils/setFloatingElemPosition";

export const useToolbarPosition = (
    editor: LexicalEditor,
    anchorElem: HTMLElement,
    popupRef: RefObject<HTMLDivElement | null>
) => {
    const $updatePosition = useCallback(() => {
        const selection = $getSelection();
        const popupElem = popupRef.current;
        const nativeSelection = getDOMSelection(editor._window);

        if (popupElem === null) return;

        const rootElement = editor.getRootElement();
        if (
            selection !== null &&
            nativeSelection !== null &&
            !nativeSelection.isCollapsed &&
            rootElement !== null &&
            rootElement.contains(nativeSelection.anchorNode)
        ) {
            const rangeRect = getDOMRangeRect(nativeSelection, rootElement);
            setFloatingElemPosition(rangeRect, popupElem, anchorElem);
        }
    }, [editor, anchorElem, popupRef]);

    useEffect(() => {
        const scrollerElem = anchorElem.parentElement;
        const update = () => editor.getEditorState().read(() => $updatePosition());

        window.addEventListener("resize", update);
        if (scrollerElem) scrollerElem.addEventListener("scroll", update);

        return () => {
            window.removeEventListener("resize", update);
            if (scrollerElem) scrollerElem.removeEventListener("scroll", update);
        };
    }, [editor, $updatePosition, anchorElem]);

    useEffect(() => {
        editor.getEditorState().read(() => $updatePosition());
        return mergeRegister(
            editor.registerUpdateListener(({ editorState }) => editorState.read(() => $updatePosition())),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    editor.getEditorState().read(() => $updatePosition());
                    return false;
                },
                COMMAND_PRIORITY_LOW
            )
        );
    }, [editor, $updatePosition]);
};

export const useMouseDragListener = (popupRef: RefObject<HTMLDivElement | null>) => {
    const mouseMoveListener = useCallback(
        (e: MouseEvent) => {
            if (popupRef?.current && (e.buttons === 1 || e.buttons === 3))
                if (popupRef.current.style.pointerEvents !== "none") {
                    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
                    if (!popupRef.current.contains(elementUnderMouse)) popupRef.current.style.pointerEvents = "none";
                }
        },
        [popupRef]
    );

    const mouseUpListener = useCallback(
        (_e: MouseEvent) => {
            if (popupRef?.current)
                if (popupRef.current.style.pointerEvents !== "auto") popupRef.current.style.pointerEvents = "auto";
        },
        [popupRef]
    );

    useEffect(() => {
        if (popupRef?.current) {
            document.addEventListener("mousemove", mouseMoveListener);
            document.addEventListener("mouseup", mouseUpListener);
            return () => {
                document.removeEventListener("mousemove", mouseMoveListener);
                document.removeEventListener("mouseup", mouseUpListener);
            };
        }
        return undefined;
    }, [mouseMoveListener, mouseUpListener, popupRef]);
};
