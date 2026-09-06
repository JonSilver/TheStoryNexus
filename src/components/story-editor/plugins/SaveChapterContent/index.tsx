import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { debounce } from "lodash";
import { useEffect, useRef } from "react";
import { useUpdateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { logger } from "@/utils/logger";

export function SaveChapterContentPlugin(): null {
    const [editor] = useLexicalComposerContext();
    const { currentChapterId } = useStoryContext();
    const updateChapterMutation = useUpdateChapterMutation();

    // Create stable debounced save function using ref
    const saveContentRef = useRef(
        debounce((chapterId: string, content: string) => {
            logger.info("SaveChapterContent - Saving content for chapter:", chapterId);
            updateChapterMutation.mutate(
                { id: chapterId, data: { content } },
                {
                    onSuccess: () => {
                        logger.info("SaveChapterContent - Content saved successfully");
                    },
                    onError: error => {
                        logger.error("SaveChapterContent - Failed to save content:", error);
                    }
                }
            );
        }, 1000)
    );

    // Register update listener
    useEffect(() => {
        if (!currentChapterId) return undefined;

        const saveContent = saveContentRef.current;

        const removeUpdateListener = editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
            // Skip if no changes
            if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

            // Read-only means foreign/unloadable content — never write it back
            if (!editor.isEditable()) return;

            // Get the editor state as JSON
            const content = JSON.stringify(editorState.toJSON());

            // Save the content
            saveContent(currentChapterId, content);
        });

        const flushPendingSave = () => saveContent.flush();
        // beforeunload is unreliable on iOS Safari; visibilitychange fires on app backgrounding
        const flushWhenHidden = () => {
            if (document.visibilityState === "hidden") saveContent.flush();
        };
        window.addEventListener("beforeunload", flushPendingSave);
        window.addEventListener("pagehide", flushPendingSave);
        document.addEventListener("visibilitychange", flushWhenHidden);

        return () => {
            removeUpdateListener();
            window.removeEventListener("beforeunload", flushPendingSave);
            window.removeEventListener("pagehide", flushPendingSave);
            document.removeEventListener("visibilitychange", flushWhenHidden);
            saveContent.flush();
        };
    }, [editor, currentChapterId]);

    return null;
}
