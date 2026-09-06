import { useCallback, useEffect, useRef, useState } from "react";
import {
    $createParagraphNode,
    $createTextNode,
    $getNodeByKey,
    $setState,
    HISTORY_MERGE_TAG,
    HISTORY_PUSH_TAG,
    type LexicalNode,
    type NodeKey
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ChevronDown, ChevronRight, Loader2, Sparkles, Trash2 } from "lucide-react";
import { ContextInspector } from "../../ai/ContextInspector";
import { useChapterIdentity } from "../ChapterContext";
import {
    activeTakeState,
    collapsedState,
    commandState,
    $isSceneBeatNode,
    statusState,
    takesState
} from "../nodes/SceneBeatNode";
import { useSceneBeatData } from "../useSceneBeatData";
import { useSceneBeatGeneration } from "../useSceneBeatGeneration";
import { PovPicker } from "./PovPicker";
import { TakeViewer } from "./TakeViewer";

const stopKeydown = (e: KeyboardEvent) => e.stopPropagation();

/** Elapsed seconds while waiting for the first token — cold model loads get a heartbeat. */
const useWarmupSeconds = (waiting: boolean) => {
    const [seconds, setSeconds] = useState(0);
    useEffect(() => {
        if (!waiting) {
            setSeconds(0);
            return undefined;
        }
        const timer = setInterval(() => setSeconds(s => s + 1), 1000);
        return () => clearInterval(timer);
    }, [waiting]);
    return seconds;
};

export const SceneBeatComponent = ({ nodeKey }: { nodeKey: NodeKey }) => {
    const [editor] = useLexicalComposerContext();
    const { command, status, takes, activeTake, streaming, collapsed } = useSceneBeatData(nodeKey);
    const { storyId, chapterId } = useChapterIdentity();
    const { generate, stop, mutate, abortActive, textBeforeNode } = useSceneBeatGeneration(nodeKey);
    const isolatedRef = useRef<HTMLTextAreaElement | null>(null);
    const isGenerating = status === "generating";
    const warmupSeconds = useWarmupSeconds(isGenerating && !streaming);

    /**
     * Lexical's keydown listener sits on the contenteditable root, below the
     * React root container, so React synthetic stopPropagation runs too late —
     * a native listener is required (spike finding).
     */
    const isolateKeys = useCallback((el: HTMLTextAreaElement | null) => {
        isolatedRef.current?.removeEventListener("keydown", stopKeydown);
        isolatedRef.current = el;
        el?.addEventListener("keydown", stopKeydown);
    }, []);

    const insertActiveTake = (node: ReturnType<typeof $getNodeByKey> & LexicalNode) => {
        const text = takes[Math.min(activeTake, takes.length - 1)] ?? "";
        const paragraphs = text
            .split(/\n{2,}/)
            .map(p => p.trim())
            .filter(Boolean)
            .map(p => {
                const paragraph = $createParagraphNode();
                paragraph.append($createTextNode(p));
                return paragraph;
            });
        paragraphs.reduce<LexicalNode>((prev, p) => {
            prev.insertAfter(p);
            return p;
        }, node);
        paragraphs[paragraphs.length - 1]?.selectEnd();
    };

    // Accept keeps the beat (and every take) for later; tidy removes the
    // spent machinery from the prose in the same undo step
    const accept = (removeBeat: boolean) =>
        editor.update(
            () => {
                const node = $getNodeByKey(nodeKey);
                if (!$isSceneBeatNode(node)) return;
                insertActiveTake(node);
                if (removeBeat) node.remove();
                else {
                    $setState(node, statusState, "accepted");
                    $setState(node, collapsedState, true);
                }
            },
            { tag: HISTORY_PUSH_TAG }
        );

    const selectTake = (index: number) => mutate(node => $setState(node, activeTakeState, index), HISTORY_MERGE_TAG);

    const deleteTake = (index: number) =>
        mutate(node => {
            const remaining = takes.filter((_, i) => i !== index);
            $setState(node, takesState, remaining);
            $setState(node, activeTakeState, Math.min(index, Math.max(remaining.length - 1, 0)));
            if (remaining.length === 0) $setState(node, statusState, "idle");
        }, HISTORY_PUSH_TAG);

    const remove = () => {
        abortActive();
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if ($isSceneBeatNode(node)) node.remove();
        });
    };

    const toggleCollapsed = () => mutate(node => $setState(node, collapsedState, prev => !prev), HISTORY_MERGE_TAG);

    return (
        <div
            className="my-2 rounded-lg border border-primary/30 bg-muted/40 text-sm"
            data-status={status}
            data-node-key={nodeKey}
        >
            <header className="flex items-center gap-2 px-3 py-2">
                <button
                    type="button"
                    onClick={toggleCollapsed}
                    aria-label={collapsed ? "Expand scene beat" : "Collapse scene beat"}
                    className="text-muted-foreground"
                >
                    {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="min-w-0 flex-1 truncate font-medium">
                    {collapsed && command ? command : "Scene Beat"}
                </span>
                <span className="text-xs text-muted-foreground">{status}</span>
                <button type="button" onClick={remove} aria-label="Delete scene beat" className="text-muted-foreground">
                    <Trash2 className="h-4 w-4" />
                </button>
            </header>

            {!collapsed && (
                <div className="space-y-2 px-3 pb-3">
                    <textarea
                        ref={isolateKeys}
                        className="w-full resize-y rounded-md border bg-background p-2 text-sm"
                        value={command}
                        rows={2}
                        placeholder="Describe what happens in this beat…"
                        disabled={isGenerating}
                        onChange={e => {
                            const next = e.target.value;
                            mutate(node => $setState(node, commandState, next), HISTORY_MERGE_TAG);
                        }}
                    />
                    <PovPicker nodeKey={nodeKey} disabled={isGenerating} />

                    {isGenerating && (
                        <div className="whitespace-pre-wrap rounded-md border bg-background/60 p-2">
                            {streaming || (
                                <span className="flex items-center gap-2 text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    {warmupSeconds > 3 ? `warming the model… ${warmupSeconds}s` : "starting…"}
                                </span>
                            )}
                        </div>
                    )}
                    {!isGenerating && (
                        <TakeViewer
                            takes={takes}
                            activeTake={activeTake}
                            onSelect={selectTake}
                            onDelete={deleteTake}
                            onAccept={removeBeat => accept(removeBeat)}
                            onRefine={guidance => void generate(command, guidance)}
                        />
                    )}

                    <footer className="flex items-center gap-2">
                        {isGenerating ? (
                            <button type="button" onClick={stop} className="rounded-md border px-3 py-1 text-sm">
                                Stop
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => void generate(command)}
                                disabled={!command.trim()}
                                className="rounded-md border px-3 py-1 text-sm disabled:opacity-50"
                            >
                                {takes.length > 0 ? "New take" : "Generate"}
                            </button>
                        )}
                        <span className="ml-auto">
                            <ContextInspector
                                actionId="scene_beat"
                                storyId={storyId}
                                chapterId={chapterId}
                                buildEditorContext={() => ({ command, recentProse: textBeforeNode() })}
                            />
                        </span>
                    </footer>
                </div>
            )}
        </div>
    );
};
