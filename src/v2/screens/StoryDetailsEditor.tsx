import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { useCreateSeriesMutation, useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { useStoryQuery, useUpdateStoryMutation } from "@/features/stories/hooks/useStoriesQuery";

const NEW_SERIES = "__new__";

/**
 * The story's own settings, on the More screen: title, synopsis, and — the
 * point of the exercise — series membership. Joining a series makes its
 * bible entries flow into this story's AI context (hierarchy: global →
 * series → story).
 */
export const StoryDetailsEditor = ({ storyId }: { storyId: string }) => {
    const { data: story } = useStoryQuery(storyId);
    const { data: allSeries } = useSeriesQuery();
    const updateStory = useUpdateStoryMutation();
    const createSeries = useCreateSeriesMutation();
    const [draft, setDraft] = useState<{ title: string; synopsis: string } | null>(null);

    useEffect(() => setDraft(null), [storyId]);
    if (!story) return null;

    const value = draft ?? { title: story.title, synopsis: story.synopsis ?? "" };
    const dirty = draft !== null && (value.title !== story.title || value.synopsis !== (story.synopsis ?? ""));

    const setSeries = (selected: string) => {
        if (selected === NEW_SERIES) {
            const name = window.prompt("Name for the new series")?.trim();
            if (!name) return;
            createSeries.mutate(
                { name, description: "" },
                {
                    onSuccess: created => {
                        updateStory.mutate({ id: storyId, data: { seriesId: created.id } });
                        toast.success(`“${story.title}” joined the new series “${name}”`);
                    }
                }
            );
            return;
        }
        updateStory.mutate({ id: storyId, data: { seriesId: selected || null } as Partial<typeof story> });
    };

    return (
        <section className="border-t p-4">
            <h2 className="font-medium">Story details</h2>
            <div className="mt-2 space-y-2 text-sm">
                <input
                    className="w-full rounded-md border bg-background px-3 py-2"
                    aria-label="Story title"
                    value={value.title}
                    onChange={e => setDraft({ ...value, title: e.target.value })}
                />
                <textarea
                    className="min-h-20 w-full resize-y rounded-md border bg-background p-2"
                    aria-label="Synopsis"
                    placeholder="Synopsis…"
                    value={value.synopsis}
                    onChange={e => setDraft({ ...value, synopsis: e.target.value })}
                />
                <label className="flex items-center gap-2">
                    <span className="shrink-0 text-muted-foreground">Series</span>
                    <select
                        className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5"
                        aria-label="Series"
                        value={story.seriesId ?? ""}
                        onChange={e => setSeries(e.target.value)}
                    >
                        <option value="">— standalone —</option>
                        {(allSeries ?? []).map(s => (
                            <option key={s.id} value={s.id}>
                                {s.name}
                            </option>
                        ))}
                        <option value={NEW_SERIES}>+ New series…</option>
                    </select>
                </label>
                {story.seriesId && (
                    <p className="text-xs text-muted-foreground">
                        Series bible entries are included in this story's AI context automatically.
                    </p>
                )}
                {dirty && (
                    <button
                        type="button"
                        className="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
                        disabled={updateStory.isPending || !value.title.trim()}
                        onClick={() =>
                            updateStory.mutate(
                                { id: storyId, data: { title: value.title.trim(), synopsis: value.synopsis } },
                                { onSuccess: () => setDraft(null) }
                            )
                        }
                    >
                        Save
                    </button>
                )}
            </div>
        </section>
    );
};
