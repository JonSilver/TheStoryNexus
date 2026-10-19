import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryQuery, useUpdateStoryMutation } from "@/features/stories/hooks/useStoriesQuery";
import { GenerationProgress } from "../ai/GenerationProgress";
import { useActionGeneration } from "../ai/useActionGeneration";
import { flushChapterSave } from "../editor/useChapterSaver";

const VOICE_CHAR_CAP = 2000;

// An unsaved voice draft (often a paid derivation) outlives leaving the screen, on this device
const DRAFT_KEY = "storynexus-voice-draft:";
const readDraft = (storyId: string): string | null => {
    try {
        return localStorage.getItem(DRAFT_KEY + storyId);
    } catch {
        return null;
    }
};
const keepDraft = (storyId: string, draft: string | null) => {
    try {
        if (draft === null) localStorage.removeItem(DRAFT_KEY + storyId);
        else localStorage.setItem(DRAFT_KEY + storyId, draft);
    } catch {
        // No storage: the draft lasts while the screen is open, as before
    }
};

export const StoryVoiceEditor = ({ storyId }: { storyId: string }) => {
    const { data: story } = useStoryQuery(storyId);
    const updateStory = useUpdateStoryMutation();
    const generation = useActionGeneration();
    const { data: chapters } = useChaptersByStoryQuery(storyId);
    const [draft, setDraftState] = useState<string | null>(() => readDraft(storyId));
    const [derived, setDerived] = useState(false);
    const setDraft = (next: string | null) => {
        keepDraft(storyId, next);
        setDraftState(next);
    };

    useEffect(() => {
        setDraftState(readDraft(storyId));
        setDerived(false);
    }, [storyId]);

    if (!story) return null;
    const value = draft ?? story.aiInstructions ?? "";
    const dirty = draft !== null && draft !== (story.aiInstructions ?? "");
    const deriving = generation.phase === "streaming";

    // The draft lands in the box for review and editing — nothing is saved until the writer saves it
    const hasProse = (chapters ?? []).some(c => (c.wordCount ?? 0) > 0);
    const derive = async () => {
        if (dirty && !window.confirm("Replace your unsaved changes to the voice with a drafted one?")) return;
        // Read what's on screen, not a second-old save
        await Promise.all((chapters ?? []).map(c => flushChapterSave(c.id)));
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
                        className="ml-auto flex items-center gap-1 rounded-md border px-3 py-1 disabled:opacity-50"
                        onClick={() => void derive()}
                        disabled={!hasProse}
                        title={
                            hasProse
                                ? "Reads passages from across the story and drafts its voice for you to review"
                                : "Write or import some prose first"
                        }
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
