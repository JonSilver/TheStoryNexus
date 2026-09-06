import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHorizontalRuleNode } from "@lexical/react/LexicalHorizontalRuleNode";
import {
    $createParagraphNode,
    $getNodeByKey,
    $getSelection,
    $isRangeSelection,
    $isTextNode,
    type NodeKey
} from "lexical";
import { Minus, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { $createSceneBeatNode } from "../nodes/SceneBeatNode";

/**
 * Cursor-local slash menu (contracts Phase 5). Opens only when the caret sits
 * directly after a lone "/" in its paragraph — measured at the selection, not
 * against the document tail like v1's broken implementation. The slash node's
 * key is captured at open time: tapping a menu button blurs the editor and
 * loses the selection, so inserts act on the captured node. Rendered as a
 * bottom bar — immune to floating-popover positioning bugs and comfortable
 * under a thumb.
 */
export const SlashMenuPlugin = () => {
    const [editor] = useLexicalComposerContext();
    const [slashNodeKey, setSlashNodeKey] = useState<NodeKey | null>(null);

    useEffect(
        () =>
            editor.registerUpdateListener(({ editorState }) => {
                const key = editorState.read(() => {
                    const selection = $getSelection();
                    if (!$isRangeSelection(selection) || !selection.isCollapsed()) return null;
                    const node = selection.anchor.getNode();
                    const isLoneSlash =
                        $isTextNode(node) &&
                        node.getTextContent() === "/" &&
                        selection.anchor.offset === 1 &&
                        node.getParent()?.getChildrenSize() === 1;
                    return isLoneSlash ? node.getKey() : null;
                });
                // Keep the menu open while the slash node survives, even if the
                // editor loses focus to the menu buttons themselves
                if (key) setSlashNodeKey(key);
                else
                    setSlashNodeKey(prev =>
                        prev && editorState.read(() => $getNodeByKey(prev)?.getTextContent() === "/") ? prev : null
                    );
            }),
        [editor]
    );

    const withSlashNode = (fn: (paragraph: ReturnType<typeof $createParagraphNode>) => void) => {
        const key = slashNodeKey;
        if (!key) return;
        setSlashNodeKey(null);
        editor.update(() => {
            const slashNode = $getNodeByKey(key);
            if (!slashNode || !$isTextNode(slashNode)) return;
            const paragraph = slashNode.getParent();
            slashNode.remove();
            if (paragraph) fn(paragraph as ReturnType<typeof $createParagraphNode>);
        });
    };

    const insertSceneBeat = () =>
        withSlashNode(paragraph => {
            const beat = $createSceneBeatNode();
            paragraph.insertBefore(beat);
            paragraph.selectStart();
        });

    const insertDivider = () =>
        withSlashNode(paragraph => {
            paragraph.insertBefore($createHorizontalRuleNode());
            paragraph.selectStart();
        });

    const dismiss = () => withSlashNode(paragraph => paragraph.selectStart());

    if (!slashNodeKey) return null;
    return (
        <div className="flex items-center gap-2 border-t bg-background px-3 py-2 text-sm">
            <span className="text-xs text-muted-foreground">Insert:</span>
            <button
                type="button"
                onClick={insertSceneBeat}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5"
            >
                <Sparkles className="h-4 w-4" /> Scene Beat
            </button>
            <button
                type="button"
                onClick={insertDivider}
                className="flex items-center gap-1 rounded-md border px-3 py-1.5"
            >
                <Minus className="h-4 w-4" /> Divider
            </button>
            <button type="button" onClick={dismiss} aria-label="Dismiss" className="ml-auto text-muted-foreground">
                <X className="h-4 w-4" />
            </button>
        </div>
    );
};
