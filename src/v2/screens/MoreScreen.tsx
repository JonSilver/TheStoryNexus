import {
    BookMarked,
    BookOpen,
    BookOpenText,
    ExternalLink,
    Library,
    Lightbulb,
    NotebookPen,
    Settings,
    SlidersHorizontal
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useStoryQuery, useUpdateStoryMutation } from "@/features/stories/hooks/useStoriesQuery";
import { useV2Store } from "../state/useV2Store";
import { ExportButtons } from "./ExportButtons";

const LINKS = [
    { to: "/settings", label: "AI Settings", icon: Settings },
    { to: "/series", label: "Series", icon: Library },
    { to: "/guide", label: "Guide", icon: BookMarked },
    { to: "/", label: "v1 workspace (everything not yet in v2)", icon: ExternalLink }
] as const;

const VOICE_CHAR_CAP = 2000;

const StoryVoiceEditor = ({ storyId }: { storyId: string }) => {
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

export const MoreScreen = ({ goTo }: { goTo?: (tool: "bible" | "actions" | "notes" | "brainstorm") => void }) => {
    const { currentStoryId } = useV2Store();

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <header className="border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <h1 className="text-lg font-semibold">More</h1>
            </header>
            {currentStoryId && goTo && (
                <>
                    <button
                        type="button"
                        onClick={() => goTo("bible")}
                        className="flex items-center gap-3 border-t px-4 py-3 text-left"
                    >
                        <BookOpenText className="h-5 w-5 text-muted-foreground" />
                        Story Bible (AI extraction)
                    </button>
                    <button
                        type="button"
                        onClick={() => goTo("brainstorm")}
                        className="flex items-center gap-3 border-t px-4 py-3 text-left"
                    >
                        <Lightbulb className="h-5 w-5 text-muted-foreground" />
                        Brainstorm
                    </button>
                    <button
                        type="button"
                        onClick={() => goTo("notes")}
                        className="flex items-center gap-3 border-t px-4 py-3 text-left"
                    >
                        <NotebookPen className="h-5 w-5 text-muted-foreground" />
                        Notes
                    </button>
                    <Link to={`/stories/${currentStoryId}/read`} className="flex items-center gap-3 border-t px-4 py-3">
                        <BookOpen className="h-5 w-5 text-muted-foreground" />
                        Read this story
                    </Link>
                </>
            )}
            {goTo && (
                <button
                    type="button"
                    onClick={() => goTo("actions")}
                    className="flex items-center gap-3 border-t px-4 py-3 text-left"
                >
                    <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                    AI Actions (advanced overrides)
                </button>
            )}
            {currentStoryId && <StoryVoiceEditor storyId={currentStoryId} />}
            {currentStoryId && <ExportButtons storyId={currentStoryId} />}
            <ul className="divide-y border-t">
                {LINKS.map(({ to, label, icon: Icon }) => (
                    <li key={to}>
                        <Link to={to} className="flex items-center gap-3 px-4 py-3">
                            <Icon className="h-5 w-5 text-muted-foreground" />
                            {label}
                        </Link>
                    </li>
                ))}
            </ul>
            <p className="mt-auto p-4 text-center text-xs text-muted-foreground">
                The Story Nexus v2 preview — brainstorm, lorebook, notes and prompts still live in the v1 workspace
                during the rebuild.
            </p>
        </div>
    );
};
