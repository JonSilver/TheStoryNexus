import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, type NodeKey } from "lexical";
import { useCallback, useRef } from "react";
import { useSyncExternalStore } from "react";
import { $isSceneBeatNode, $readSceneBeat, type SceneBeatData } from "./nodes/SceneBeatNode";

const MISSING: SceneBeatData = {
    command: "",
    status: "idle",
    generatedText: "",
    collapsed: false,
    povCharacter: "",
    povType: ""
};

const same = (a: SceneBeatData, b: SceneBeatData) =>
    a.command === b.command &&
    a.status === b.status &&
    a.generatedText === b.generatedText &&
    a.collapsed === b.collapsed &&
    a.povCharacter === b.povCharacter &&
    a.povType === b.povType;

/** Reads a SceneBeatNode's state reactively without duplicating it in React state. */
export const useSceneBeatData = (nodeKey: NodeKey): SceneBeatData => {
    const [editor] = useLexicalComposerContext();
    const cache = useRef<SceneBeatData>(MISSING);

    const subscribe = useCallback((onChange: () => void) => editor.registerUpdateListener(onChange), [editor]);

    const getSnapshot = useCallback(() => {
        const next = editor.getEditorState().read(() => {
            const node = $getNodeByKey(nodeKey);
            return $isSceneBeatNode(node) ? $readSceneBeat(node) : MISSING;
        });
        if (same(cache.current, next)) return cache.current;
        cache.current = next;
        return next;
    }, [editor, nodeKey]);

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
};
