import { attemptPromise } from "@jfdi/attempt";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookUp, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { useCreateStoryMutation, useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";
import { adminApi, storiesApi } from "@/services/api/client";
import { randomUUID } from "@/utils/crypto";
import type { ScreenProps } from "../V2App";
import { useV2Store } from "../state/useV2Store";
import { ImportSheet } from "./ImportSheet";

export const StoriesScreen = ({ goTo }: ScreenProps) => {
    const { currentStoryId, setCurrentStory } = useV2Store();
    const { data: stories, isLoading, isError, refetch } = useStoriesQuery();
    const { data: allSeries } = useSeriesQuery();

    // Series are first-class: grouped with their stories, standalone last
    const groups = [
        ...(allSeries ?? [])
            .map(series => ({ heading: series.name, items: (stories ?? []).filter(s => s.seriesId === series.id) }))
            .filter(group => group.items.length > 0),
        { heading: null as string | null, items: (stories ?? []).filter(s => !s.seriesId) }
    ];
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

    const importJson = async (file: File) => {
        const [error, story] = await attemptPromise(() => storiesApi.importStory(file));
        if (error || !story) {
            toast.error("Couldn't import that JSON — is it a story export?");
            return;
        }
        void queryClient.invalidateQueries();
        toast.success(`Imported “${story.title}”`);
    };

    const create = () => {
        const title = newTitle.trim();
        if (!title) return;
        createStory.mutate(
            { id: randomUUID(), title, author: "", language: "British English", synopsis: "" },
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
                <h1 className="text-lg font-semibold">Library</h1>
                <label className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm">
                    JSON
                    <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        aria-label="Import story JSON"
                        onChange={e => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) void importJson(file);
                        }}
                    />
                </label>
                <button
                    type="button"
                    onClick={() => setImporting(true)}
                    className="ml-2 flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
                >
                    <BookUp className="h-4 w-4" /> Import
                </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {isError ? (
                    <div className="flex flex-col items-center gap-3 p-8 text-center text-sm">
                        <p className="text-muted-foreground">
                            Couldn't reach the server — your stories are safe on disk.
                        </p>
                        <button type="button" className="rounded-md border px-3 py-1.5" onClick={() => void refetch()}>
                            Try again
                        </button>
                    </div>
                ) : isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <ul>
                        {groups.map(group => (
                            <li key={group.heading ?? "__standalone__"}>
                                {group.heading && (
                                    <h2 className="bg-muted/50 px-4 py-1 text-xs font-semibold uppercase text-muted-foreground">
                                        {group.heading}
                                    </h2>
                                )}
                                <ul className="divide-y">
                                    {group.items.map(story => (
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
                                                    <p className="truncate text-xs text-muted-foreground">
                                                        {story.synopsis}
                                                    </p>
                                                )}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
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
