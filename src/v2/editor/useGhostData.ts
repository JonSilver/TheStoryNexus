import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, type NodeKey } from "lexical";
import { useCallback, useRef } from "react";
import { useSyncExternalStore } from "react";
import { $isGhostSuggestionNode, $readGhost } from "./nodes/GhostSuggestionNode";

interface GhostData {
    text: string;
    ghostStatus: "streaming" | "done";
}

const MISSING: GhostData = { text: "", ghostStatus: "done" };

/** Reactive read of a ghost suggestion node's state. */
export const useGhostData = (nodeKey: NodeKey): GhostData => {
    const [editor] = useLexicalComposerContext();
    const cache = useRef<GhostData>(MISSING);

    const subscribe = useCallback((onChange: () => void) => editor.registerUpdateListener(onChange), [editor]);

    const getSnapshot = useCallback(() => {
        const next = editor.getEditorState().read(() => {
            const node = $getNodeByKey(nodeKey);
            return $isGhostSuggestionNode(node) ? $readGhost(node) : MISSING;
        });
        if (cache.current.text === next.text && cache.current.ghostStatus === next.ghostStatus) return cache.current;
        cache.current = next;
        return next;
    }, [editor, nodeKey]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
