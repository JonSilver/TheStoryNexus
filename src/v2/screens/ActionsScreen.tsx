import { Pencil } from "lucide-react";
import { useState } from "react";
import { useAISettingsQuery } from "@/features/ai/hooks/useAISettingsQuery";
import { ScreenHeader } from "../components/ScreenParts";
import { OverrideEditor } from "../drawer/OverrideEditor";
import { type ActionDefinition, type OverrideRow, useActionRegistry, useOverrides } from "../drawer/useActionOverrides";
import { useCurrentStory } from "../hooks/useCurrentStory";
import { useNav } from "../routing";
import { useCurrentStoryId } from "../state/useV2Store";

const CUSTOMISABLE = ["template", "temperature", "maxTokens", "topP", "frequencyPenalty", "presencePenalty"] as const;

const modelName = (ref: string | null | undefined) =>
    ref
        ?.split("::")
        .slice(1)
        .join("::")
        .replace(/^local\//, "");

/** "built-in" or "customised", and the model that runs: the action's own, all stories' (seen from a story), or the default. */
const describeOverride = (override: OverrideRow | null, inherited: OverrideRow | null, defaultModel: string | null) => {
    const customised = CUSTOMISABLE.some(key => override?.[key] !== null && override?.[key] !== undefined);
    const own = modelName(override?.modelRef);
    const fromAllStories = modelName(inherited?.modelRef);
    const model =
        own ?? (fromAllStories ? `${fromAllStories} (all stories)` : defaultModel && `${defaultModel} (default)`);
    return [customised ? "customised" : "built-in", model && `model: ${model}`].filter(Boolean).join(" · ");
};

/**
 * The advanced drawer (contracts Phase 8): per-action template and parameter
 * overrides, globally or per story. Present, optional, out of the writing path.
 */
export const ActionsScreen = () => {
    const { goBack } = useNav();
    const currentStoryId = useCurrentStoryId();
    const story = useCurrentStory();
    const [scope, setScope] = useState<"global" | "story">("global");
    const storyId = scope === "story" ? (story?.id ?? null) : null;
    const { data: registry } = useActionRegistry();
    const { data: overrides } = useOverrides(storyId);
    const { data: globalOverrides } = useOverrides(null);
    const { data: settings } = useAISettingsQuery();
    const defaultModel = settings?.defaultModelId?.replace(/^local\//, "") ?? null;
    const [editing, setEditing] = useState<ActionDefinition | null>(null);

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title="AI Actions (advanced)" onBack={() => goBack("settings")} />

            <div className="flex gap-2 border-b p-3 text-sm">
                <button
                    type="button"
                    onClick={() => setScope("global")}
                    aria-pressed={scope === "global"}
                    className={`rounded-md border px-3 py-1.5 ${scope === "global" ? "bg-accent" : ""}`}
                >
                    All stories
                </button>
                <button
                    type="button"
                    onClick={() => setScope("story")}
                    // Only a story that exists can have overrides of its own
                    disabled={!story}
                    aria-pressed={scope === "story"}
                    className={`min-w-0 rounded-md border px-3 py-1.5 text-left disabled:opacity-50 ${scope === "story" ? "bg-accent" : ""}`}
                >
                    {!currentStoryId ? "This story (none open)" : story ? `This story: ${story.title}` : "This story"}
                </button>
            </div>

            <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
                {(registry ?? []).map(def => {
                    const override = (overrides ?? []).find(o => o.actionId === def.id) ?? null;
                    return (
                        <li key={def.id}>
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 px-4 py-3 text-left"
                                onClick={() => setEditing(def)}
                            >
                                <div className="min-w-0 flex-1">
                                    <p className="font-medium">{def.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {describeOverride(
                                            override,
                                            storyId
                                                ? ((globalOverrides ?? []).find(o => o.actionId === def.id) ?? null)
                                                : null,
                                            defaultModel
                                        )}
                                        {def.voiceApplies ? " · uses story voice" : ""}
                                    </p>
                                </div>
                                <Pencil className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </li>
                    );
                })}
            </ul>

            {editing && (
                <OverrideEditor
                    def={editing}
                    override={(overrides ?? []).find(o => o.actionId === editing.id) ?? null}
                    storyId={storyId}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
};
