import { useCallback, useRef } from "react";
import {
    $createParagraphNode,
    $createTextNode,
    $getNodeByKey,
    $getState,
    $setState,
    HISTORY_MERGE_TAG,
    HISTORY_PUSH_TAG,
    type LexicalNode,
    type NodeKey,
    type UpdateTag
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ChevronDown, ChevronRight, Sparkles, Trash2 } from "lucide-react";
import {
    collapsedState,
    commandState,
    generatedTextState,
    $isSceneBeatNode,
    type SceneBeatNode,
    statusState
} from "../nodes/SceneBeatNode";
import { useSceneBeatData } from "../useSceneBeatData";

const stopKeydown = (e: KeyboardEvent) => e.stopPropagation();

export const SceneBeatComponent = ({ nodeKey }: { nodeKey: NodeKey }) => {
    const [editor] = useLexicalComposerContext();
    const { command, status, generatedText, collapsed } = useSceneBeatData(nodeKey);
    const isolatedRef = useRef<HTMLTextAreaElement | null>(null);

    const mutate = useCallback(
        (fn: (node: SceneBeatNode) => void, tag: UpdateTag | UpdateTag[]) =>
            editor.update(
                () => {
                    const node = $getNodeByKey(nodeKey);
                    if ($isSceneBeatNode(node)) fn(node);
                },
                { tag }
            ),
        [editor, nodeKey]
    );

    /**
     * Lexical's keydown listener sits on the contenteditable root, below the
     * React root container, so React synthetic stopPropagation runs too late —
     * shortcuts like Ctrl+A get swallowed by the editor. Native listener
     * required (React 18: manual attach/detach in the ref callback).
     */
    const isolateKeys = useCallback((el: HTMLTextAreaElement | null) => {
        isolatedRef.current?.removeEventListener("keydown", stopKeydown);
        isolatedRef.current = el;
        el?.addEventListener("keydown", stopKeydown);
    }, []);

    const accept = () =>
        mutate((node) => {
            const text = $getState(node, generatedTextState);
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
            $setState(node, statusState, "accepted");
            $setState(node, generatedTextState, "");
            $setState(node, collapsedState, true);
            paragraphs[paragraphs.length - 1]?.selectEnd();
        }, HISTORY_PUSH_TAG);

    const reject = () =>
        mutate((node) => {
            $setState(node, statusState, "idle");
            $setState(node, generatedTextState, "");
        }, HISTORY_PUSH_TAG);

    const remove = () =>
        editor.update(() => {
            const node = $getNodeByKey(nodeKey);
            if ($isSceneBeatNode(node)) node.remove();
        });

    const toggleCollapsed = () => mutate((node) => $setState(node, collapsedState, prev => !prev), HISTORY_MERGE_TAG);

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
                <span className="font-medium">Scene Beat</span>
                <span className="ml-auto text-xs text-muted-foreground">{status}</span>
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
                        disabled={status === "generating"}
                        onChange={e => {
                            const next = e.target.value;
                            mutate((node) => $setState(node, commandState, next), HISTORY_MERGE_TAG);
                        }}
                    />

                    {generatedText && (
                        <div className="whitespace-pre-wrap rounded-md border bg-background/60 p-2">{generatedText}</div>
                    )}

                    <footer className="flex items-center gap-2">
                        <button
                            type="button"
                            disabled
                            title="Generation arrives with the AI actions phase"
                            className="rounded-md border px-3 py-1 text-sm opacity-50"
                        >
                            Generate
                        </button>
                        {status === "done" && generatedText && (
                            <>
                                <button
                                    type="button"
                                    onClick={accept}
                                    className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground"
                                >
                                    Accept
                                </button>
                                <button type="button" onClick={reject} className="rounded-md border px-3 py-1 text-sm">
                                    Reject
                                </button>
                            </>
                        )}
                    </footer>
                </div>
            )}
        </div>
    );
};
