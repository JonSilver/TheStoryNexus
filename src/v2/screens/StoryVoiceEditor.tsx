import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useStoryQuery, useUpdateStoryMutation } from "@/features/stories/hooks/useStoriesQuery";
import { GenerationProgress } from "../ai/GenerationProgress";
import { useActionGeneration } from "../ai/useActionGeneration";

const VOICE_CHAR_CAP = 2000;

export const StoryVoiceEditor = ({ storyId }: { storyId: string }) => {
    const { data: story } = useStoryQuery(storyId);
    const updateStory = useUpdateStoryMutation();
    const generation = useActionGeneration();
    const [draft, setDraft] = useState<string | null>(null);
    const [derived, setDerived] = useState(false);

    useEffect(() => {
        setDraft(null);
        setDerived(false);
    }, [storyId]);

    if (!story) return null;
    const value = draft ?? story.aiInstructions ?? "";
    const dirty = draft !== null && draft !== (story.aiInstructions ?? "");
    const deriving = generation.phase === "streaming";

    // The draft lands in the box for review and editing — nothing is saved until the writer saves it
    const derive = async () => {
        const result = await generation.run({ actionId: "derive_voice", storyId });
        if (result.outcome !== "complete" || !result.text.trim()) return;
        setDraft(result.text.trim().slice(0, VOICE_CHAR_CAP));
        setDerived(true);
        generation.reset();
    };

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
                aria-label="Story voice"
                maxLength={VOICE_CHAR_CAP}
                value={value}
                disabled={deriving}
                onChange={e => setDraft(e.target.value)}
            />
            {deriving && <GenerationProgress status={generation.status} className="mt-1" />}
            {generation.error && !deriving && (
                <p className="mt-1 text-xs text-destructive" role="alert">
                    {generation.error}
                </p>
            )}
            {derived && dirty && (
                <p className="mt-1 text-xs text-muted-foreground">
                    Drafted from your writing — edit it, then Save. Discard keeps your current voice.
                </p>
            )}
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                    {value.length}/{VOICE_CHAR_CAP}
                </span>
                {deriving ? (
                    <button type="button" className="ml-auto rounded-md border px-3 py-1" onClick={generation.abort}>
                        Stop
                    </button>
                ) : (
                    <button
                        type="button"
                        className="ml-auto flex items-center gap-1 rounded-md border px-3 py-1"
                        onClick={() => void derive()}
                        title="Reads passages from across the story and drafts its voice for you to review"
                    >
                        <Sparkles className="h-3.5 w-3.5" /> Derive from my writing
                    </button>
                )}
                {dirty && !deriving && (
                    <>
                        {derived && (
                            <button
                                type="button"
                                className="rounded-md border px-3 py-1"
                                onClick={() => {
                                    setDraft(null);
                                    setDerived(false);
                                }}
                            >
                                Discard
                            </button>
                        )}
                        <button
                            type="button"
                            className="rounded-md bg-primary px-3 py-1 text-primary-foreground disabled:opacity-50"
                            disabled={updateStory.isPending}
                            onClick={() =>
                                updateStory.mutate(
                                    { id: storyId, data: { aiInstructions: draft ?? "" } },
                                    {
                                        onSuccess: () => {
                                            setDraft(null);
                                            setDerived(false);
                                        }
                                    }
                                )
                            }
                        >
                            Save
                        </button>
                    </>
                )}
            </div>
        </section>
    );
};
