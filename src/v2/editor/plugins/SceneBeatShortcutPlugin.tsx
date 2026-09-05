import { useEffect } from "react";
import { $createParagraphNode, $getSelection, COMMAND_PRIORITY_LOW, KEY_DOWN_COMMAND } from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createSceneBeatNode } from "../nodes/SceneBeatNode";

/** Alt+S / Option+S inserts a scene beat at the caret (desktop path). */
export const SceneBeatShortcutPlugin = () => {
    const [editor] = useLexicalComposerContext();

    useEffect(
        () =>
            editor.registerCommand(
                KEY_DOWN_COMMAND,
                event => {
                    if (!event.altKey || event.code !== "KeyS") return false;
                    event.preventDefault();
                    editor.update(() => {
                        const selection = $getSelection();
                        selection?.insertNodes([$createSceneBeatNode(), $createParagraphNode()]);
                    });
                    return true;
                },
                COMMAND_PRIORITY_LOW
            ),
        [editor]
    );

    return null;
};
