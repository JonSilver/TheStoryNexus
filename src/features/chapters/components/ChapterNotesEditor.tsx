import debounce from "lodash/debounce";
import { useEffect, useMemo, useState } from "react";
import Editor from "react-simple-wysiwyg";
import { cn } from "@/lib/utils";
import type { Chapter, ChapterNotes } from "@/types/story";
import { useUpdateChapterMutation } from "../hooks/useChaptersQuery";

interface ChapterNotesEditorProps {
    chapter: Chapter;
    onClose: () => void;
}

export function ChapterNotesEditor({ chapter, onClose: _onClose }: ChapterNotesEditorProps) {
    const updateChapterMutation = useUpdateChapterMutation();
    const [content, setContent] = useState(chapter?.notes?.content || "");
    const [lastSavedContent, setLastSavedContent] = useState(chapter?.notes?.content || "");

    // Create a debounced save function
    const debouncedSave = useMemo(
        () =>
            debounce(async (newContent: string) => {
                if (!chapter) return;

                const notes: ChapterNotes = {
                    content: newContent,
                    lastUpdated: new Date()
                };

                updateChapterMutation.mutate(
                    {
                        id: chapter.id,
                        data: { notes }
                    },
                    {
                        onSuccess: () => {
                            setLastSavedContent(newContent);
                        }
                    }
                );
            }, 1000),
        [chapter, updateChapterMutation]
    );

    useEffect(() => {
        if (content !== lastSavedContent) debouncedSave(content);
    }, [content, lastSavedContent, debouncedSave]);

    useEffect(
        () => () => {
            debouncedSave.cancel();
        },
        [debouncedSave]
    );

    return (
        <div className="space-y-4">
            <div>
                {chapter?.notes && (
                    <p className="text-sm text-muted-foreground">
                        Last updated: {new Date(chapter.notes.lastUpdated).toLocaleString()}
                    </p>
                )}
            </div>
            <Editor
                value={content}
                onChange={e => setContent(e.target.value)}
                containerProps={{
                    style: { height: "82vh" },
                    className: cn("prose prose-sm max-w-none", "dark:prose-invert")
                }}
                style={{ height: "100%", overflow: "auto" }}
            />
        </div>
    );
}
