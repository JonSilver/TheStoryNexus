import { toast } from "react-toastify";
import { useDemoExistsQuery, useRestoreDemoMutation } from "@/features/demo/hooks/useDemoData";
import { useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import {
    useCreateStoryMutation,
    useImportStoryMutation,
    useStoriesQuery
} from "@/features/stories/hooks/useStoriesQuery";
import { randomUUID } from "@/utils/crypto";

/** Every story, grouped by series (series first, standalone last), and the ways new ones arrive. */
export const useLibrary = () => {
    const { data: stories, isLoading, isError, refetch } = useStoriesQuery();
    const { data: allSeries } = useSeriesQuery();
    const { data: demoExists } = useDemoExistsQuery();
    const createStory = useCreateStoryMutation();
    const importStory = useImportStoryMutation();
    const restoreDemo = useRestoreDemoMutation();

    const groups = [
        ...(allSeries ?? [])
            .map(series => ({ heading: series.name, items: (stories ?? []).filter(s => s.seriesId === series.id) }))
            .filter(group => group.items.length > 0),
        { heading: null as string | null, items: (stories ?? []).filter(s => !s.seriesId) }
    ];

    const create = (title: string, onCreated: (storyId: string) => void) =>
        createStory.mutate(
            { id: randomUUID(), title, author: "", language: "British English", synopsis: "" },
            { onSuccess: story => onCreated(story.id) }
        );

    /** A story JSON backup, restored; the counts say what came back, and any images that didn't. */
    const importJson = (file: File, onRestored: (storyId: string) => void) =>
        importStory.mutate(file, {
            onSuccess: ({ storyId, title, imported, assetsFailed }) => {
                toast.success(
                    `Restored “${title}” — ${imported.chapters ?? 0} chapters, ${imported.lorebookEntries ?? 0} bible entries, ` +
                        `${imported.notes ?? 0} notes, ${imported.assets ?? 0} images`
                );
                if (assetsFailed.length > 0)
                    toast.error(`${assetsFailed.length} image(s) couldn't be restored: ${assetsFailed.join(", ")}`);
                onRestored(storyId);
            }
        });

    return {
        groups,
        isEmpty: (stories ?? []).length === 0,
        isLoading,
        isError,
        refetch,
        create,
        creating: createStory.isPending,
        importJson,
        canRestoreDemo: demoExists === false,
        restoreDemo: () => restoreDemo.mutate(undefined, { onSuccess: () => toast.success("Sample story restored") }),
        restoringDemo: restoreDemo.isPending
    };
};
