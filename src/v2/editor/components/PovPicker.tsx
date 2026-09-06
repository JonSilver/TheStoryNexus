import { $setState, HISTORY_MERGE_TAG, type NodeKey } from "lexical";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { useChapterIdentity } from "../ChapterContext";
import { povCharacterState, povTypeState } from "../nodes/SceneBeatNode";
import { useSceneBeatData } from "../useSceneBeatData";
import { useSceneBeatGeneration } from "../useSceneBeatGeneration";

const POV_TYPES = ["", "First Person", "Third Person Limited", "Third Person Omniscient"] as const;

/** Optional per-beat POV: type plus a character drawn from the story bible. */
export const PovPicker = ({ nodeKey, disabled }: { nodeKey: NodeKey; disabled: boolean }) => {
    const { storyId } = useChapterIdentity();
    const { povCharacter, povType } = useSceneBeatData(nodeKey);
    const { mutate } = useSceneBeatGeneration(nodeKey);
    const { data: entries } = useHierarchicalLorebookQuery(storyId);
    const characters = (entries ?? []).filter(e => e.category === "character");

    return (
        <div className="flex gap-2 text-xs">
            <select
                className="rounded-md border bg-background px-2 py-1"
                value={povType}
                disabled={disabled}
                aria-label="POV type"
                onChange={e => {
                    const value = e.target.value;
                    mutate(node => $setState(node, povTypeState, value), HISTORY_MERGE_TAG);
                }}
            >
                {POV_TYPES.map(type => (
                    <option key={type} value={type}>
                        {type || "POV: chapter default"}
                    </option>
                ))}
            </select>
            {characters.length > 0 && (
                <select
                    className="min-w-0 rounded-md border bg-background px-2 py-1"
                    value={povCharacter}
                    disabled={disabled}
                    aria-label="POV character"
                    onChange={e => {
                        const value = e.target.value;
                        mutate(node => $setState(node, povCharacterState, value), HISTORY_MERGE_TAG);
                    }}
                >
                    <option value="">character…</option>
                    {characters.map(c => (
                        <option key={c.id} value={c.name}>
                            {c.name}
                        </option>
                    ))}
                </select>
            )}
        </div>
    );
};
