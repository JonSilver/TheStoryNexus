import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { useCreateStoryMutation, useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";
import { useV2Store } from "../state/useV2Store";
import type { ScreenProps } from "../V2App";

export const StoriesScreen = ({ goTo }: ScreenProps) => {
    const { currentStoryId, setCurrentStory } = useV2Store();
    const { data: stories, isLoading } = useStoriesQuery();
    const createStory = useCreateStoryMutation();
    const [newTitle, setNewTitle] = useState("");

    const create = () => {
        const title = newTitle.trim();
        if (!title) return;
        createStory.mutate(
            { id: crypto.randomUUID(), title, author: "", language: "English", synopsis: "" },
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
            <header className="border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <h1 className="text-lg font-semibold">Stories</h1>
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
                                No stories yet — create one below.
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
        </div>
    );
};
