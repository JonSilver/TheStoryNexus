import { attempt } from "@jfdi/attempt";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { useEffect, useState } from "react";
import { useChapterQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { logger } from "@/utils/logger";

export function LoadChapterContentPlugin(): null {
    const [editor] = useLexicalComposerContext();
    const { currentChapterId } = useStoryContext();
    const { data: currentChapter } = useChapterQuery(currentChapterId || "");
    const [hasLoaded, setHasLoaded] = useState(false);

    // Reset hasLoaded when chapter changes
    useEffect(() => {
        if (currentChapterId) 
            setHasLoaded(false);
        
    }, [currentChapterId]);

    // Set editor content when chapter data is available
    useEffect(() => {
        if (!hasLoaded && currentChapter?.content && currentChapter.id === currentChapterId) 
            // Defer to microtask to avoid flushSync warning
            queueMicrotask(() => {
                const [error] = attempt(() => {
                    // Parse and set the editor state
                    const parsedState = editor.parseEditorState(currentChapter.content);
                    editor.setEditorState(parsedState);
                    setHasLoaded(true);
                });
                if (error) {
                    logger.error("LoadChapterContent - Failed to load content:", error);

                    // Only in case of error, try to create an empty editor state
                    const [recoveryError] = attempt(() => {
                        editor.setEditorState(
                            editor.parseEditorState(
                                '{"root":{"children":[{"children":[],"direction":"ltr","format":"","indent":0,"type":"paragraph","version":1}],"direction":"ltr","format":"","indent":0,"type":"root","version":1}}'
                            )
                        );
                        setHasLoaded(true);
                    });
                    if (recoveryError) {
                        logger.error("LoadChapterContent - Recovery failed:", recoveryError);
                    }
                }
            });
        
    }, [editor, currentChapter, currentChapterId, hasLoaded]);

    return null;
}
