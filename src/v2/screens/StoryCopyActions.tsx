import { useIsMutating } from "@tanstack/react-query";
import { Copy, Shuffle } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useDuplicateStoryMutation } from "@/features/stories/hooks/useStoriesQuery";
import { useStartTranspositionMutation } from "@/features/transpositions/hooks/useTranspositionQuery";
import type { Story } from "@/types/story";
import { usePrompt } from "../components/Dialogs";
import { flushChapterSave } from "../editor/useChapterSaver";
import { useNav } from "../routing";
import { uiState } from "../state/useV2Store";

const reportImages = (assetsFailed: string[]) => {
    if (assetsFailed.length > 0)
        toast.error(`${assetsFailed.length} image(s) couldn't be copied: ${assetsFailed.join(", ")}`);
};

/**
 * The two ways to make a copy of a story: a plain duplicate, and a copy to
 * transpose to another time or place. Both copy what the writer just did —
 * a save still on its way (details, series, voice) keeps them disabled, and
 * the open chapter's last keystrokes are saved first.
 */
export const StoryCopyActions = ({ story }: { story: Story | undefined }) => {
    const { goTo } = useNav();
    const prompt = usePrompt();
    const saving = useIsMutating();
    const duplicateStory = useDuplicateStoryMutation();
    const startTransposition = useStartTranspositionMutation();
    const [flushing, setFlushing] = useState<"duplicate" | "transpose" | null>(null);
    const busy = flushing !== null || duplicateStory.isPending || startTransposition.isPending || saving > 0;

    const settle = async (storyId: string, why: "duplicate" | "transpose") => {
        const openChapter = uiState.lastChapterFor(storyId);
        setFlushing(why);
        if (openChapter) await flushChapterSave(openChapter);
        setFlushing(null);
    };

    const duplicate = async () => {
        if (!story) return;
        const title = await prompt({
            title: "Duplicate story",
            label: "Title of the copy",
            initial: `${story.title} (copy)`,
            confirmLabel: "Duplicate"
        });
        if (!title) return;
        await settle(story.id, "duplicate");
        duplicateStory.mutate(
            { id: story.id, title },
            {
                onSuccess: ({ storyId, assetsFailed }) => {
                    reportImages(assetsFailed);
                    goTo("story", { storyId });
                }
            }
        );
    };

    const transpose = async () => {
        if (!story) return;
        const target = await prompt({
            title: "Transpose story",
            label: "Where and when should it be set?",
            confirmLabel: "Make a copy and start"
        });
        if (!target) return;
        await settle(story.id, "transpose");
        startTransposition.mutate(
            { sourceStoryId: story.id, target },
            {
                onSuccess: ({ storyId, assetsFailed }) => {
                    reportImages(assetsFailed);
                    goTo("transpose", { storyId });
                }
            }
        );
    };

    const rowClass = "flex w-full items-center gap-3 px-4 py-3 text-left text-sm disabled:opacity-50";
    return (
        <div className="mt-auto">
            <button type="button" onClick={duplicate} disabled={!story || busy} className={rowClass}>
                <Copy className="h-4 w-4" />{" "}
                {flushing === "duplicate" || duplicateStory.isPending ? "Duplicating…" : "Duplicate this story…"}
            </button>
            <button type="button" onClick={transpose} disabled={!story || busy} className={rowClass}>
                <Shuffle className="h-4 w-4" />{" "}
                {flushing === "transpose" || startTransposition.isPending
                    ? "Making the copy to transpose…"
                    : "Transpose to another time or place…"}
            </button>
        </div>
    );
};
