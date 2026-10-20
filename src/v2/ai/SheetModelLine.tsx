import { ModelSelector } from "@/components/ui/model-selector";
import { isSameModel, useAISettingsQuery } from "@/features/ai/hooks/useAISettingsQuery";
import type { AnsweredModel } from "@/types/actions";
import type { ModelChoice } from "@/types/story";

export interface SheetModel {
    /** The model behind the text on show (or the run in progress). */
    shown: AnsweredModel | null;
    /** What the latest run resolved to: a change is saved where that choice came from. */
    scope: "story" | "global";
    /** "Rework", "Summarise"… */
    actionLabel: string;
    onChoose: (next: ModelChoice | null) => void;
}

const SOURCE_NAMES: Record<AnsweredModel["source"], string | null> = {
    default: "your default model",
    global: "chosen for all stories",
    story: "chosen for this story",
    request: null
};

/**
 * Which model wrote what the sheet shows, and — when the writer asks — the
 * picker to give this action a different one, saved where the current choice
 * came from (this story's setting if it has one, else all stories').
 */
export const SheetModelLine = ({
    model,
    choosing,
    onChoosing,
    canChange
}: {
    model: SheetModel;
    choosing: boolean;
    onChoosing: (choosing: boolean) => void;
    canChange: boolean;
}) => {
    const { data: settings } = useAISettingsQuery();
    const { shown, scope, actionLabel } = model;
    const name = shown
        ? (settings?.availableModels.find(m => isSameModel({ provider: m.provider, modelId: m.id }, shown))?.name ??
          shown.modelId.replace(/^local\//, ""))
        : null;
    const source = shown && SOURCE_NAMES[shown.source];
    const defaultName = settings?.defaultModelId?.replace(/^local\//, "");

    if (choosing && canChange)
        return (
            <div className="space-y-1 px-4 pb-2 text-xs">
                <p className="text-muted-foreground">
                    Model for {actionLabel} in {scope === "story" ? "this story" : "all stories"} — choosing one tries
                    again with it
                </p>
                <ModelSelector
                    ariaLabel={`Model for ${actionLabel}`}
                    defaultOpen
                    value={shown && shown.source !== "default" ? shown : null}
                    onChange={next => {
                        onChoosing(false);
                        model.onChoose(next);
                    }}
                    noneLabel={
                        scope === "story"
                            ? "Same as all stories"
                            : `App default${defaultName ? ` (${defaultName})` : ""}`
                    }
                />
            </div>
        );
    if (!name) return null;
    return (
        <p className="flex items-center gap-2 px-4 pb-2 text-xs text-muted-foreground">
            <span className="min-w-0 truncate">
                Model: <span className="text-foreground">{name}</span>
                {source && ` (${source})`}
            </span>
            {canChange && (
                <button type="button" onClick={() => onChoosing(true)} className="shrink-0 underline">
                    Change model
                </button>
            )}
        </p>
    );
};
