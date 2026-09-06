import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { $getRoot, type EditorState } from "lexical";
import { countWords } from "@/utils/textUtils";

/**
 * Bridges editor changes into the revision-aware saver.
 * ignoreHistoryMergeTagChange MUST be false: streamed scene-beat tokens are
 * tagged history-merge and would otherwise never reach autosave (spike §2).
 * DecoratorNodes contribute no text, so scene beats are excluded from the
 * word count for free. The saver skips content identical to the last save,
 * which also covers the initial-load change.
 */
export const ChapterPersistencePlugin = ({
    onDocument
}: {
    onDocument: (serialised: string, wordCount: number, text: string) => void;
}) => {
    const handleChange = (editorState: EditorState) => {
        const serialised = JSON.stringify(editorState.toJSON());
        const text = editorState.read(() => $getRoot().getTextContent());
        onDocument(serialised, countWords(text), text);
    };

    return <OnChangePlugin onChange={handleChange} ignoreSelectionChange ignoreHistoryMergeTagChange={false} />;
};
