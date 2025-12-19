import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import type { JSX } from "react";
import { type Dispatch } from "react";
import { createPortal } from "react-dom";
import { FloatingLinkEditor } from "./FloatingLinkEditor";
import { useFloatingLinkEditorToolbar } from "./useFloatingLinkEditorToolbar";
import "./index.css";

export default function FloatingLinkEditorPlugin({
    anchorElem = document.body,
    isLinkEditMode,
    setIsLinkEditMode
}: {
    anchorElem?: HTMLElement;
    isLinkEditMode: boolean;
    setIsLinkEditMode: Dispatch<boolean>;
}): JSX.Element | null {
    const [editor] = useLexicalComposerContext();
    const { activeEditor, isLink, setIsLink } = useFloatingLinkEditorToolbar(editor);

    return createPortal(
        <FloatingLinkEditor
            editor={activeEditor}
            isLink={isLink}
            anchorElem={anchorElem}
            setIsLink={setIsLink}
            isLinkEditMode={isLinkEditMode}
            setIsLinkEditMode={setIsLinkEditMode}
        />,
        anchorElem
    );
}
