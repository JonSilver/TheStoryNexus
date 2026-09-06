import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical";
import { Bold, Italic, Maximize2, MessageSquareQuote, Minimize2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { ToolbarActions } from "./AiActionButtons";

interface MenuState {
    x: number;
    y: number;
}

/**
 * The app's own context menu on selected text — right-click (and Android
 * long-press, which fires contextmenu) gets the AI selection actions and
 * basic formatting instead of the browser's generic menu. With no
 * selection the browser menu is left alone (paste etc. still works).
 */
export const SelectionContextMenu = ({ actions }: { actions: ToolbarActions }) => {
    const [editor] = useLexicalComposerContext();
    const [menu, setMenu] = useState<MenuState | null>(null);

    useEffect(() => {
        const root = editor.getRootElement();
        if (!root) return undefined;
        const onContextMenu = (event: MouseEvent) => {
            const hasSelection = editor
                .getEditorState()
                .read(() => $isRangeSelection($getSelection()) && $getSelection()?.getTextContent().trim().length);
            if (!hasSelection) return;
            event.preventDefault();
            const menuWidth = 190;
            const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
            const y = Math.min(event.clientY, window.innerHeight - 240);
            setMenu({ x, y });
        };
        root.addEventListener("contextmenu", onContextMenu);
        return () => root.removeEventListener("contextmenu", onContextMenu);
    }, [editor]);

    if (!menu) return null;

    const item = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent";
    const run = (action: () => void) => () => {
        setMenu(null);
        action();
    };

    return (
        <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} onContextMenu={e => e.preventDefault()}>
            <div
                role="menu"
                aria-label="Selection actions"
                className="absolute w-[190px] overflow-hidden rounded-lg border bg-background shadow-lg"
                style={{ left: menu.x, top: menu.y }}
                onClick={e => e.stopPropagation()}
            >
                <button
                    type="button"
                    className={item}
                    onClick={run(() => actions.onSelectionAction("rework", "Rework"))}
                >
                    <RefreshCw className="h-4 w-4" /> Rework
                </button>
                <button
                    type="button"
                    className={item}
                    onClick={run(() => actions.onSelectionAction("expand", "Expand"))}
                >
                    <Maximize2 className="h-4 w-4" /> Expand
                </button>
                <button
                    type="button"
                    className={item}
                    onClick={run(() => actions.onSelectionAction("shorten", "Shorten"))}
                >
                    <Minimize2 className="h-4 w-4" /> Shorten
                </button>
                <button type="button" className={item} onClick={run(actions.onAsk)}>
                    <MessageSquareQuote className="h-4 w-4" /> Ask…
                </button>
                <div className="border-t" />
                <button
                    type="button"
                    className={item}
                    onClick={run(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold"))}
                >
                    <Bold className="h-4 w-4" /> Bold
                </button>
                <button
                    type="button"
                    className={item}
                    onClick={run(() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic"))}
                >
                    <Italic className="h-4 w-4" /> Italic
                </button>
            </div>
        </div>
    );
};
