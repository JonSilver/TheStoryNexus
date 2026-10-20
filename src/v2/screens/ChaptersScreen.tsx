import { ChevronDown, ChevronUp, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
    useChaptersByStoryQuery,
    useCreateChapter,
    useDeleteChapterMutation,
    useMoveChapter
} from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import { useConfirm } from "../components/Dialogs";
import { NoStoryChosen, ScreenHeader } from "../components/ScreenParts";
import { useNav } from "../routing";
import { useCurrentStoryId } from "../state/useV2Store";
import { ChapterDetailsSheet } from "./ChapterDetailsSheet";

export const ChaptersScreen = () => {
    const { goTo, goBack } = useNav();
    const currentStoryId = useCurrentStoryId();
    const { data: story } = useStoryQuery(currentStoryId ?? "");
    const { data: chapters, isLoading } = useChaptersByStoryQuery(currentStoryId ?? "");
    const createChapter = useCreateChapter();
    const moveChapter = useMoveChapter();
    const deleteChapter = useDeleteChapterMutation();
    const confirm = useConfirm();

    // The id, not a copy: the sheet sees the chapter as it is now, and closes if it's gone
    const [detailsId, setDetailsId] = useState<string | null>(null);

    const move = (index: number, direction: -1 | 1) =>
        moveChapter.mutate({ chapters: ordered, from: index, to: index + direction });

    const remove = async (id: string, title: string, words: number) => {
        const message = `Delete “${title}”${words ? ` (${words} words)` : ""}? This cannot be undone.`;
        if (await confirm({ message, confirmLabel: "Delete" })) deleteChapter.mutate(id);
    };
    const [newTitle, setNewTitle] = useState("");
    const ordered = chapters ?? [];
    const details = ordered.find(c => c.id === detailsId) ?? null;

    if (!currentStoryId) return <NoStoryChosen onChoose={() => goTo("library")} />;

    const create = () => {
        const title = newTitle.trim() || `Chapter ${ordered.length + 1}`;
        createChapter.mutate(
            { storyId: currentStoryId, title },
            {
                onSuccess: chapter => {
                    setNewTitle("");
                    // Creating a chapter takes you into it (contracts: Phase 3)
                    goTo("write", { chapterId: chapter.id });
                }
            }
        );
    };

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title="Chapters" story={story?.title} onBack={() => goBack("story")} />
            <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <ul className="divide-y">
                        {ordered.map((chapter, index) => (
                            <li key={chapter.id} className="flex items-center">
                                <span className="flex flex-col">
                                    <button
                                        type="button"
                                        onClick={() => move(index, -1)}
                                        disabled={index === 0 || moveChapter.isPending}
                                        aria-label={`Move ${chapter.title} up`}
                                        className="px-2 pt-2 text-muted-foreground disabled:opacity-30"
                                    >
                                        <ChevronUp className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => move(index, 1)}
                                        disabled={index === ordered.length - 1 || moveChapter.isPending}
                                        aria-label={`Move ${chapter.title} down`}
                                        className="px-2 pb-2 text-muted-foreground disabled:opacity-30"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                    </button>
                                </span>
                                <button
                                    type="button"
                                    className="flex min-w-0 flex-1 items-baseline justify-between px-4 py-3 text-left"
                                    onClick={() => goTo("write", { chapterId: chapter.id })}
                                >
                                    <span className="min-w-0 truncate">{chapter.title}</span>
                                    <span className="ml-3 shrink-0 text-xs text-muted-foreground">
                                        {chapter.wordCount ? `${chapter.wordCount} words` : "empty"}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDetailsId(chapter.id)}
                                    aria-label={`Edit ${chapter.title} details`}
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
            {details && <ChapterDetailsSheet chapter={details} onClose={() => setDetailsId(null)} />}
        </div>
    );
};
