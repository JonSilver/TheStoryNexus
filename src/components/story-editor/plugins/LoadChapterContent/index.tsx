import { attempt } from "@jfdi/attempt";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useChapterQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { logger } from "@/utils/logger";

const EMPTY_STATE =
    '{"root":{"children":[{"children":[],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}';

// Content this editor must not touch: v2 documents (their nodes would be
// silently mangled and saved back) and anything unparseable. Shown read-only;
// the old overwrite-with-empty recovery destroyed real chapters.
const isV2Document = (content: string) => content.includes('"scene-beat-v2"');

export function LoadChapterContentPlugin(): null {
    const [editor] = useLexicalComposerContext();
    const { currentChapterId } = useStoryContext();
    const { data: currentChapter } = useChapterQuery(currentChapterId || "");
    const [hasLoaded, setHasLoaded] = useState(false);

    // Reset hasLoaded when chapter changes
    useEffect(() => {
        if (currentChapterId) setHasLoaded(false);
    }, [currentChapterId]);

    // Set editor content when chapter data is available
    useEffect(() => {
        if (!hasLoaded && currentChapter?.content && currentChapter.id === currentChapterId)
            // Defer to microtask to avoid flushSync warning
            queueMicrotask(() => {
                const showReadOnly = (message: string) => {
                    // Read-only BEFORE clearing the view: SaveChapterContent
                    // skips non-editable updates, so nothing is written back
                    editor.setEditable(false);
                    attempt(() => editor.setEditorState(editor.parseEditorState(EMPTY_STATE)));
                    setHasLoaded(true);
                    toast.info(message);
                };

                if (isV2Document(currentChapter.content)) {
                    showReadOnly("This chapter was written in the v2 editor — open /v2 to edit it.");
                    return;
                }

                const [error] = attempt(() => {
                    const parsedState = editor.parseEditorState(currentChapter.content);
                    editor.setEditable(true);
                    editor.setEditorState(parsedState);
                    setHasLoaded(true);
                });
                if (error) {
                    logger.error("LoadChapterContent - Failed to load content:", error);
                    showReadOnly("This chapter couldn't be opened here. Nothing has been changed.");
                }
            });
    }, [editor, currentChapter, currentChapterId, hasLoaded]);

    return null;
}
