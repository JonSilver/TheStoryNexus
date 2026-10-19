import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND } from "lexical";
import { Bold, ClipboardPaste, Copy, Italic, MessageSquareQuote, Scissors } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { SELECTION_ACTIONS } from "../../ai/selectionActions";
import type { ToolbarActions } from "./AiActionButtons";

interface MenuState {
    x: number;
    y: number;
}

const MENU_WIDTH = 200;
const LONG_PRESS_MS = 550;
const LONG_PRESS_SLOP_PX = 10;

/**
 * The app's own context menu on selected text: AI selection actions,
 * clipboard, and basic formatting. Opens on right-click (and Android
 * long-press, which fires contextmenu natively) and on a hand-rolled
 * long-press for iOS Safari, which never fires contextmenu. With no
 * selection the browser menu is left alone.
 *
 * Menu items preventDefault on mousedown so the editor's DOM selection
 * survives the click — execCommand copy/cut act on it. Paste needs the
 * async clipboard API, which insecure origins (LAN http) block; the
 * fallback is an honest hint, not a silent no-op.
 */
export const SelectionContextMenu = ({ actions }: { actions: ToolbarActions }) => {
    const [editor] = useLexicalComposerContext();
    const [menu, setMenu] = useState<MenuState | null>(null);

    useEffect(() => {
        const root = editor.getRootElement();
        if (!root) return undefined;

        const hasSelection = () =>
            editor
                .getEditorState()
                .read(() => $isRangeSelection($getSelection()) && $getSelection()?.getTextContent().trim().length);

        const openAt = (clientX: number, clientY: number) =>
            setMenu({
                x: Math.min(clientX, window.innerWidth - MENU_WIDTH - 8),
                y: Math.min(clientY, window.innerHeight - 300)
            });

        const onContextMenu = (event: MouseEvent) => {
            if (!hasSelection()) return;
            event.preventDefault();
            openAt(event.clientX, event.clientY);
        };

        // iOS Safari long-press path. No preventDefault on touchstart — that
        // would kill scrolling and native selection-handle dragging.
        const press = { timer: 0 as ReturnType<typeof setTimeout> | 0, x: 0, y: 0 };
        const cancelPress = () => clearTimeout(press.timer);
        const onTouchStart = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch || event.touches.length > 1) return;
            press.x = touch.clientX;
            press.y = touch.clientY;
            cancelPress();
            press.timer = setTimeout(() => {
                if (hasSelection()) openAt(press.x, press.y);
            }, LONG_PRESS_MS);
        };
        const onTouchMove = (event: TouchEvent) => {
            const touch = event.touches[0];
            if (!touch) return;
            if (Math.hypot(touch.clientX - press.x, touch.clientY - press.y) > LONG_PRESS_SLOP_PX) cancelPress();
        };

        root.addEventListener("contextmenu", onContextMenu);
        root.addEventListener("touchstart", onTouchStart, { passive: true });
        root.addEventListener("touchmove", onTouchMove, { passive: true });
        root.addEventListener("touchend", cancelPress);
        root.addEventListener("touchcancel", cancelPress);
        return () => {
            cancelPress();
            root.removeEventListener("contextmenu", onContextMenu);
            root.removeEventListener("touchstart", onTouchStart);
            root.removeEventListener("touchmove", onTouchMove);
            root.removeEventListener("touchend", cancelPress);
            root.removeEventListener("touchcancel", cancelPress);
        };
    }, [editor]);

    if (!menu) return null;

    const item = "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent";
    const run = (action: () => void) => () => {
        setMenu(null);
        action();
    };

    const paste = async () => {
        try {
            const text = await navigator.clipboard.readText();
            if (!text) return;
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) selection.insertText(text);
            });
        } catch {
            toast.info("The browser blocks menu paste here — use Ctrl+V (⌘V).");
        }
    };

    const entries: Array<{ label: string; icon: typeof Copy; onSelect: () => void } | { divider: true }> = [
        ...SELECTION_ACTIONS.map(({ actionId, label, icon }) => ({
            label,
            icon,
            onSelect: () => actions.onSelectionAction(actionId)
        })),
        { label: "Ask…", icon: MessageSquareQuote, onSelect: actions.onAsk },
        { divider: true },
        { label: "Cut", icon: Scissors, onSelect: () => document.execCommand("cut") },
        { label: "Copy", icon: Copy, onSelect: () => document.execCommand("copy") },
        { label: "Paste", icon: ClipboardPaste, onSelect: () => void paste() },
        { divider: true },
        { label: "Bold", icon: Bold, onSelect: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold") },
        { label: "Italic", icon: Italic, onSelect: () => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic") }
    ];

    return (
        <div className="fixed inset-0 z-50" onClick={() => setMenu(null)} onContextMenu={e => e.preventDefault()}>
            <div
                role="menu"
                aria-label="Selection actions"
                className="absolute w-[200px] overflow-hidden rounded-lg border bg-background shadow-lg"
                style={{ left: menu.x, top: menu.y }}
                onClick={e => e.stopPropagation()}
            >
                {entries.map((entry, index) =>
                    "divider" in entry ? (
                        <div key={index} className="border-t" />
                    ) : (
                        <button
                            key={entry.label}
                            type="button"
                            role="menuitem"
                            className={item}
                            // Keep the editor's DOM selection alive through the click
                            onMouseDown={e => e.preventDefault()}
                            onClick={run(entry.onSelect)}
                        >
                            <entry.icon className="h-4 w-4" /> {entry.label}
                        </button>
                    )
                )}
            </div>
        </div>
    );
};
