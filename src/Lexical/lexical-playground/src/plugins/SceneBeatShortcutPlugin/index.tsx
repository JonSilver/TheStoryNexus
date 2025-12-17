/**
 * SceneBeatShortcutPlugin - Adds keyboard shortcut support for inserting Scene Beat nodes
 */

import {
    $createParagraphNode,
    $getSelection,
    COMMAND_PRIORITY_NORMAL,
    KEY_MODIFIER_COMMAND,
    type LexicalEditor
} from "lexical";
import { useEffect } from "react";
import { $createSceneBeatNode } from "../../nodes/SceneBeatNode";
import { isInsertSceneBeat } from "../ShortcutsPlugin/shortcuts";

export default function SceneBeatShortcutPlugin({ editor }: { editor: LexicalEditor }): null {
    useEffect(() => {
        const keyboardShortcutsHandler = (payload: KeyboardEvent) => {
            const event: KeyboardEvent = payload;

            if (isInsertSceneBeat(event)) {
                event.preventDefault();

                editor.update(() => {
                    const selection = $getSelection();
                    if (selection) {
                        // Create node without ID - hook will generate UUID and create DB record
                        const beatNode = $createSceneBeatNode();
                        const paragraphNode = $createParagraphNode();
                        selection.insertNodes([beatNode, paragraphNode]);
                    }
                });

                return true;
            }

            return false;
        };

        return editor.registerCommand(KEY_MODIFIER_COMMAND, keyboardShortcutsHandler, COMMAND_PRIORITY_NORMAL);
    }, [editor]);

    return null;
}
