import { useEffect, useState } from "react";
import { useStoryQuery, useUpdateStoryMutation } from "@/features/stories/hooks/useStoriesQuery";

const VOICE_CHAR_CAP = 2000;

export const StoryVoiceEditor = ({ storyId }: { storyId: string }) => {
    const { data: story } = useStoryQuery(storyId);
    const updateStory = useUpdateStoryMutation();
    const [draft, setDraft] = useState<string | null>(null);

    useEffect(() => {
        setDraft(null);
    }, [storyId]);

    if (!story) return null;
    const value = draft ?? story.aiInstructions ?? "";
    const dirty = draft !== null && draft !== (story.aiInstructions ?? "");

    return (
        <section className="border-t p-4">
            <h2 className="font-medium">Story voice &amp; framing</h2>
            <p className="mb-2 text-xs text-muted-foreground">
                Style, tense, tone and framing rules for “{story.title}” — followed by every prose AI action. Facts
                belong in the lorebook, voice belongs here.
            </p>
            <textarea
                className="min-h-28 w-full resize-y rounded-md border bg-background p-2 text-sm"
                placeholder="e.g. Past tense, third person limited. Dry wit, short sentences. Never name the narrator."
                maxLength={VOICE_CHAR_CAP}
                value={value}
                onChange={e => setDraft(e.target.value)}
            />
            <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                    {value.length}/{VOICE_CHAR_CAP}
                </span>
                {dirty && (
                    <button
                        type="button"
                        className="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
                        disabled={updateStory.isPending}
                        onClick={() =>
                            updateStory.mutate(
                                { id: storyId, data: { aiInstructions: draft ?? "" } },
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
