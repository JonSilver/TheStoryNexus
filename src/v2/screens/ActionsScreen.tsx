import { Pencil } from "lucide-react";
import { useState } from "react";
import { ScreenHeader } from "../components/ScreenParts";
import { OverrideEditor } from "../drawer/OverrideEditor";
import { type ActionDefinition, useActionRegistry, useOverrides } from "../drawer/useActionOverrides";
import { useNav } from "../routing";
import { useCurrentStoryId } from "../state/useV2Store";

/**
 * The advanced drawer (contracts Phase 8): per-action template and parameter
 * overrides, globally or per story. Present, optional, out of the writing path.
 */
export const ActionsScreen = () => {
    const { goBack } = useNav();
    const currentStoryId = useCurrentStoryId();
    const [scope, setScope] = useState<"global" | "story">("global");
    const storyId = scope === "story" ? currentStoryId : null;
    const { data: registry } = useActionRegistry();
    const { data: overrides } = useOverrides(storyId);
    const [editing, setEditing] = useState<ActionDefinition | null>(null);

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title="AI Actions (advanced)" onBack={() => goBack("settings")} />

            <div className="flex gap-2 border-b p-3 text-sm">
                <button
                    type="button"
                    onClick={() => setScope("global")}
                    className={`rounded-md border px-3 py-1.5 ${scope === "global" ? "bg-accent" : ""}`}
                >
                    All stories
                </button>
                <button
                    type="button"
                    onClick={() => setScope("story")}
                    disabled={!currentStoryId}
                    className={`rounded-md border px-3 py-1.5 disabled:opacity-50 ${scope === "story" ? "bg-accent" : ""}`}
                >
                    This story
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
                                        {override ? "customised" : "built-in"}
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
