import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $getRoot, type EditorState } from "lexical";
import { throttle } from "lodash";
import { useEffect, useMemo } from "react";
import { countWords } from "@/utils/textUtils";

const THROTTLE_MS = 300;

/**
 * Bridges editor changes into the revision-aware saver.
 * ignoreHistoryMergeTagChange MUST be false: streamed scene-beat tokens are
 * tagged history-merge and would otherwise never reach autosave (spike §2).
 * DecoratorNodes contribute no text, so scene beats are excluded from the
 * word count for free. The saver skips content identical to the last save,
 * which also covers the initial-load change.
 *
 * Serialisation is throttled: JSON.stringify of the whole document plus a
 * full text extraction per streamed token is O(document) main-thread work.
 * Leading + trailing keeps the first keystroke immediate and the final
 * state durable; the throttle flushes on unmount so nothing is dropped.
 */
export const ChapterPersistencePlugin = ({
    onDocument
}: {
    onDocument: (serialised: string, wordCount: number, text: string) => void;
}) => {
    const handleChange = useMemo(
        () =>
            throttle(
                (editorState: EditorState) => {
                    const serialised = JSON.stringify(editorState.toJSON());
                    const text = editorState.read(() => $getRoot().getTextContent());
                    onDocument(serialised, countWords(text), text);
                },
                THROTTLE_MS,
                { leading: true, trailing: true }
            ),
        [onDocument]
    );

    useEffect(() => () => handleChange.flush(), [handleChange]);

    return <OnChangePlugin onChange={handleChange} ignoreSelectionChange ignoreHistoryMergeTagChange={false} />;
};
