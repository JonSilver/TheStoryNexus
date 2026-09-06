import { attemptPromise } from "@jfdi/attempt";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookUp, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useCreateStoryMutation, useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";
import { adminApi } from "@/services/api/client";
import { randomUUID } from "@/utils/crypto";
import type { ScreenProps } from "../V2App";
import { useV2Store } from "../state/useV2Store";
import { ImportSheet } from "./ImportSheet";

export const StoriesScreen = ({ goTo }: ScreenProps) => {
    const { currentStoryId, setCurrentStory } = useV2Store();
    const { data: stories, isLoading } = useStoriesQuery();
    const createStory = useCreateStoryMutation();
    const [newTitle, setNewTitle] = useState("");
    const [importing, setImporting] = useState(false);
    const queryClient = useQueryClient();
    const { data: demoExists } = useQuery({
        queryKey: ["demo-exists"],
        queryFn: () => adminApi.checkDemoExists().then(r => r.exists)
    });

    const restoreDemo = async () => {
        const [error] = await attemptPromise(() => adminApi.importDemoData());
        if (error) {
            toast.error("Couldn't restore the sample story");
            return;
        }
        void queryClient.invalidateQueries();
        toast.success("Sample story restored");
    };

    const create = () => {
        const title = newTitle.trim();
        if (!title) return;
        createStory.mutate(
            { id: randomUUID(), title, author: "", language: "English", synopsis: "" },
            {
                onSuccess: story => {
                    setNewTitle("");
                    setCurrentStory(story.id);
                    goTo("chapters");
                }
            }
        );
    };

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-center border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <h1 className="text-lg font-semibold">Stories</h1>
                <button
                    type="button"
                    onClick={() => setImporting(true)}
                    className="ml-auto flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
                >
                    <BookUp className="h-4 w-4" /> Import
                </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <ul className="divide-y">
                        {(stories ?? []).map(story => (
                            <li key={story.id}>
                                <button
                                    type="button"
                                    className={`w-full px-4 py-3 text-left ${story.id === currentStoryId ? "bg-accent/40" : ""}`}
                                    onClick={() => {
                                        setCurrentStory(story.id);
                                        goTo("write");
                                    }}
                                >
                                    <p className="truncate font-medium">{story.title}</p>
                                    {story.synopsis && (
                                        <p className="truncate text-xs text-muted-foreground">{story.synopsis}</p>
                                    )}
                                </button>
                            </li>
                        ))}
                        {(stories ?? []).length === 0 && (
                            <li className="p-8 text-center text-sm text-muted-foreground">
                                No stories yet — create one below, or import a manuscript.
                            </li>
                        )}
                    </ul>
                )}
            </div>
            <footer className="flex gap-2 border-t p-3">
                <input
                    className="min-w-0 flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="New story title"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && create()}
                />
                <button
                    type="button"
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50"
                    onClick={create}
                    disabled={createStory.isPending || !newTitle.trim()}
                >
                    <Plus className="h-4 w-4" /> Create
                </button>
            </footer>
            {demoExists === false && (
                <button
                    type="button"
                    onClick={() => void restoreDemo()}
                    className="flex items-center gap-2 border-t px-4 py-3 text-left text-sm text-muted-foreground"
                >
                    <Sparkles className="h-4 w-4" /> Restore the sample story (Shadows Over Berlin)
                </button>
            )}
            {importing && (
                <ImportSheet
                    onClose={() => setImporting(false)}
                    onImported={storyId => {
                        setImporting(false);
                        setCurrentStory(storyId);
                        goTo("chapters");
                    }}
                />
            )}
        </div>
    );
};
