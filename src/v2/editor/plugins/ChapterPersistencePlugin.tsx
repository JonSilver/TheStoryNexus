import { $getRoot, type EditorState } from "lexical";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
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
    onDocument: (serialised: string, wordCount: number) => void;
}) => {
    const handleChange = (editorState: EditorState) => {
        const serialised = JSON.stringify(editorState.toJSON());
        const wordCount = editorState.read(() => countWords($getRoot().getTextContent()));
        onDocument(serialised, wordCount);
    };

    return <OnChangePlugin onChange={handleChange} ignoreSelectionChange ignoreHistoryMergeTagChange={false} />;
};
