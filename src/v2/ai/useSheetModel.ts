import { useCallback } from "react";
import type { ActionId, AnsweredModel } from "@/types/actions";
import type { ModelChoice } from "@/types/story";
import { useOverrides, useSetActionModel } from "../drawer/useActionOverrides";
import type { SheetModel } from "./SheetModelLine";
import type { GenerationPhase } from "./useActionGeneration";

/**
 * The sheet's model line: which model wrote what's on show, and changing the
 * action's model from there — saved where the latest run's model came from
 * (a story's own choice would outrank an all-stories change), then tried again.
 */
export const useSheetModel = ({
    action,
    storyId,
    generation,
    attempts,
    onAgain
}: {
    action: { id: ActionId; label: string } | null;
    storyId: string;
    /** The latest run, and its model. */
    generation: { phase: GenerationPhase; model: AnsweredModel | null };
    attempts: { currentModel: AnsweredModel | null };
    onAgain: () => void;
}): SheetModel | null => {
    const { model: running } = generation;
    const shownAttempt = attempts.currentModel;
    const setActionModel = useSetActionModel();
    const { data: storyOverrides } = useOverrides(storyId);
    // A run refused before it began never names its model; a story's own choice still outranks all stories'
    const storyHasModel = Boolean(storyOverrides?.find(o => o.actionId === action?.id)?.modelRef);
    const known = running ?? shownAttempt;
    const scope: SheetModel["scope"] = (known ? known.source === "story" : storyHasModel) ? "story" : "global";
    const actionId = action?.id;
    const choose = useCallback(
        async (next: ModelChoice | null) => {
            if (!actionId) return;
            const saved = await setActionModel({
                actionId,
                storyId: scope === "story" ? storyId : null,
                modelRef: next && `${next.provider}::${next.modelId}`
            });
            if (saved) onAgain();
        },
        [actionId, scope, storyId, setActionModel, onAgain]
    );
    if (!action) return null;
    return {
        shown: generation.phase === "streaming" ? running : (shownAttempt ?? running),
        scope,
        actionLabel: action.label,
        onChoose: next => void choose(next)
    };
};
