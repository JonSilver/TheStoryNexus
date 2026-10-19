import { BookUp, Loader2, Plus, Sparkles } from "lucide-react";
import { useState } from "react";
import { ScreenHeader } from "../components/ScreenParts";
import { useNav } from "../routing";
import { useCurrentStoryId } from "../state/useV2Store";
import { ImportSheet } from "./ImportSheet";
import { useLibrary } from "./useLibrary";

export const StoriesScreen = () => {
    const { goTo } = useNav();
    const currentStoryId = useCurrentStoryId();
    const library = useLibrary();
    const [newTitle, setNewTitle] = useState("");
    const [importing, setImporting] = useState(false);

    const create = () => {
        const title = newTitle.trim();
        if (!title) return;
        library.create(title, storyId => {
            setNewTitle("");
            goTo("chapters", { storyId });
        });
    };

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title="Library">
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm">
                    JSON
                    <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        aria-label="Import story JSON"
                        onChange={e => {
                            const file = e.target.files?.[0];
                            e.target.value = "";
                            if (file) library.importJson(file, storyId => goTo("story", { storyId }));
                        }}
                    />
                </label>
                <button
                    type="button"
                    onClick={() => setImporting(true)}
                    className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm"
                >
                    <BookUp className="h-4 w-4" /> Import
                </button>
            </ScreenHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
                {library.isError ? (
                    <div className="flex flex-col items-center gap-3 p-8 text-center text-sm">
                        <p className="text-muted-foreground">
                            Couldn't reach the server — your stories are safe on disk.
                        </p>
                        <button
                            type="button"
                            className="rounded-md border px-3 py-1.5"
                            onClick={() => void library.refetch()}
                        >
                            Try again
                        </button>
                    </div>
                ) : library.isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <ul>
                        {library.groups.map(group => (
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
                                                    goTo("write", { storyId: story.id });
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
                        {library.isEmpty && (
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
                    disabled={library.creating || !newTitle.trim()}
                >
                    <Plus className="h-4 w-4" /> Create
                </button>
            </footer>
            {library.canRestoreDemo && (
                <button
                    type="button"
                    onClick={library.restoreDemo}
                    disabled={library.restoringDemo}
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
                        goTo("chapters", { storyId: storyId });
                    }}
                />
            )}
        </div>
    );
};
