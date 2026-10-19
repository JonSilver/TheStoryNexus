import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $getNodeByKey, HISTORY_PUSH_TAG, type NodeKey } from "lexical";
import { Check, RotateCcw, X } from "lucide-react";
import { AttemptNav } from "../../ai/AttemptNav";
import { GenerationProgress } from "../../ai/GenerationProgress";
import { RefineInput } from "../../ai/RefineInput";
import { $insertParagraphsAfter } from "../lexicalText";
import { $isGhostSuggestionNode, $readGhost } from "../nodes/GhostSuggestionNode";
import { useGhostData } from "../useGhostData";
import { useGhostGeneration } from "../useGhostGeneration";

/**
 * The inline provisional continuation: greyed prose in the manuscript with
 * Keep / Refine / Dismiss. Judging the continuation happens in the prose,
 * not in a modal over it.
 */
export const GhostSuggestion = ({ nodeKey }: { nodeKey: NodeKey }) => {
    const [editor] = useLexicalComposerContext();
    const { text, ghostStatus } = useGhostData(nodeKey);
    const ghost = useGhostGeneration(nodeKey);
    const streaming = ghostStatus === "streaming";

    const keep = () =>
        editor.update(
            () => {
                const node = $getNodeByKey(nodeKey);
                if (!$isGhostSuggestionNode(node)) return;
                $insertParagraphsAfter(node, $readGhost(node).text);
                node.remove();
            },
            { tag: HISTORY_PUSH_TAG }
        );

    const dismiss = () => {
        ghost.stop();
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if ($isGhostSuggestionNode(node)) node.remove();
        });
    };

    const button = "flex items-center gap-1 rounded-md border px-3 py-1";
    return (
        <div className="my-2 border-l-2 border-primary/40 pl-3" data-ghost>
            {ghost.failure && !streaming && (
                <p className="mb-1 text-sm not-italic text-destructive" role="alert">
                    {ghost.failure.message}
                    {text &&
                        (ghost.failure.keptPartial
                            ? " What arrived is kept below."
                            : " Your earlier continuation is still here.")}
                </p>
            )}
            <div className="whitespace-pre-wrap italic leading-relaxed text-muted-foreground">
                {text}
                {streaming && (
                    <GenerationProgress
                        status={ghost.status ?? { phase: "waiting", elapsedMs: 0 }}
                        className={`not-italic ${text ? "mt-1" : ""}`}
                    />
                )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                {streaming ? (
                    <button type="button" onClick={ghost.stop} className="rounded-md border px-3 py-1">
                        Stop
                    </button>
                ) : (
                    <>
                        {text && (
                            <button
                                type="button"
                                onClick={keep}
                                className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-primary-foreground"
                            >
                                <Check className="h-4 w-4" /> Keep
                            </button>
                        )}
                        <button type="button" onClick={ghost.again} className={button}>
                            <RotateCcw className="h-4 w-4" /> {text ? "Again" : "Try again"}
                        </button>
                        <button type="button" onClick={dismiss} className={button}>
                            <X className="h-4 w-4" /> Dismiss
                        </button>
                        {ghost.attempts.count > 1 && (
                            <AttemptNav
                                label="Continuation"
                                index={ghost.attempts.index}
                                count={ghost.attempts.count}
                                onSelect={ghost.showAttempt}
                                className="flex items-center gap-2 text-xs"
                            />
                        )}
                        {text && (
                            <RefineInput
                                onRefine={ghost.generate}
                                placeholder="Refine: e.g. slower, more dialogue…"
                                className="flex min-w-0 flex-1 gap-2"
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
