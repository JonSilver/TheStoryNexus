import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
    useChaptersByStoryQuery,
    useCreateChapterMutation,
    useDeleteChapterMutation,
    useUpdateChapterMutation
} from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import { randomUUID } from "@/utils/crypto";
import type { ScreenProps } from "../V2App";
import { useV2Store } from "../state/useV2Store";

export const ChaptersScreen = ({ goTo }: ScreenProps) => {
    const { currentStoryId, setLastChapter } = useV2Store();
    const { data: story } = useStoryQuery(currentStoryId ?? "");
    const { data: chapters, isLoading } = useChaptersByStoryQuery(currentStoryId ?? "");
    const createChapter = useCreateChapterMutation();
    const updateChapter = useUpdateChapterMutation();
    const deleteChapter = useDeleteChapterMutation();

    const rename = (id: string, current: string) => {
        const title = window.prompt("Chapter title", current)?.trim();
        if (title && title !== current) updateChapter.mutate({ id, data: { title } });
    };

    const remove = (id: string, title: string, words: number) => {
        if (window.confirm(`Delete “${title}”${words ? ` (${words} words)` : ""}? This cannot be undone.`))
            deleteChapter.mutate(id);
    };
    const [newTitle, setNewTitle] = useState("");

    if (!currentStoryId)
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-muted-foreground">Pick a story first.</p>
                <button
                    type="button"
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                    onClick={() => goTo("stories")}
                >
                    Choose a story
                </button>
            </div>
        );

    const ordered = [...(chapters ?? [])].sort((a, b) => a.order - b.order);

    const create = () => {
        const title = newTitle.trim() || `Chapter ${ordered.length + 1}`;
        createChapter.mutate(
            {
                id: randomUUID(),
                storyId: currentStoryId,
                title,
                order: ordered.length,
                content: "",
                revision: 0,
                wordCount: 0
            },
            {
                onSuccess: chapter => {
                    setNewTitle("");
                    // Creating a chapter takes you into it (contracts: Phase 3)
                    setLastChapter(currentStoryId, chapter.id);
                    goTo("write");
                }
            }
        );
    };

    return (
        <div className="flex h-full flex-col">
            <header className="border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <h1 className="text-lg font-semibold">Chapters</h1>
                <p className="truncate text-xs text-muted-foreground">{story?.title}</p>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <ul className="divide-y">
                        {ordered.map(chapter => (
                            <li key={chapter.id} className="flex items-center">
                                <button
                                    type="button"
                                    className="flex min-w-0 flex-1 items-baseline justify-between px-4 py-3 text-left"
                                    onClick={() => {
                                        setLastChapter(currentStoryId, chapter.id);
                                        goTo("write");
                                    }}
                                >
                                    <span className="min-w-0 truncate">{chapter.title}</span>
                                    <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                                        {chapter.wordCount ? `${chapter.wordCount} words` : "empty"}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => rename(chapter.id, chapter.title)}
                                    aria-label={`Rename ${chapter.title}`}
                                    className="px-2 py-3 text-muted-foreground"
                                >
                                    <Pencil className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => remove(chapter.id, chapter.title, chapter.wordCount ?? 0)}
                                    aria-label={`Delete ${chapter.title}`}
                                    className="pl-2 pr-4 py-3 text-muted-foreground"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                        {ordered.length === 0 && (
                            <li className="p-8 text-center text-sm text-muted-foreground">No chapters yet.</li>
                        )}
                    </ul>
                )}
            </div>
            <footer className="flex gap-2 border-t p-3">
                <input
                    className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="New chapter title (optional)"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && create()}
                />
                <button
                    type="button"
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                    onClick={create}
                    disabled={createChapter.isPending}
                >
                    <Plus className="h-4 w-4" /> Add
                </button>
            </footer>
        </div>
    );
};
