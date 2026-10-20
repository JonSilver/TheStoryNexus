import { RotateCcw, Square } from "lucide-react";
import { useState } from "react";
import { AttemptNav } from "../ai/AttemptNav";
import { GenerationProgress } from "../ai/GenerationProgress";
import { RefineInput } from "../ai/RefineInput";
import { SheetModelLine } from "../ai/SheetModelLine";
import type { useDraftLayer } from "./useDraftLayer";

/**
 * A text layer of the transposition: draft it, compare drafts, edit the one
 * on show, then accept it. Accepting is what moves the transposition on.
 */
export const DraftLayer = ({
    layer,
    explainer,
    draftLabel,
    acceptLabel,
    onAccept,
    accepting,
    extra
}: {
    layer: ReturnType<typeof useDraftLayer>;
    explainer: string;
    draftLabel: string;
    acceptLabel: string;
    onAccept: (text: string) => void;
    accepting: boolean;
    /** Another way on, e.g. keeping the original. */
    extra?: React.ReactNode;
}) => {
    const { generation, drafts, index, shown } = layer;
    const [choosingModel, setChoosingModel] = useState(false);
    const streaming = generation.phase === "streaming";
    const settled = !streaming;

    return (
        <section className="space-y-3 px-4 py-4">
            <p className="text-sm text-muted-foreground">{explainer}</p>
            {layer.model && (
                <SheetModelLine
                    model={layer.model}
                    choosing={choosingModel}
                    onChoosing={setChoosingModel}
                    canChange={settled && (drafts.length > 0 || generation.phase === "error")}
                />
            )}
            {streaming ? (
                <div className="min-h-32 whitespace-pre-wrap rounded-md border p-3 text-sm">
                    {generation.text}
                    <GenerationProgress status={generation.status} className={generation.text ? "mt-2" : ""} />
                </div>
            ) : shown !== null ? (
                <textarea
                    aria-label="Draft"
                    className="min-h-64 w-full resize-y rounded-md border bg-background p-3 text-sm leading-relaxed"
                    value={shown}
                    onChange={e => layer.edit(e.target.value)}
                />
            ) : null}
            {generation.error && (
                <p className="text-sm text-destructive">
                    {generation.error}
                    {drafts.length > 0 && " Your earlier drafts are kept."}
                </p>
            )}
            {layer.unsavedCount > 0 && (
                <p role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
                    {layer.unsavedCount === 1 ? "A draft hasn't" : `${layer.unsavedCount} drafts haven't`} been saved
                    yet — it's still here.{" "}
                    <button type="button" className="underline" onClick={layer.saveAgain}>
                        Save again
                    </button>
                </p>
            )}
            {settled && drafts.length > 1 && (
                <AttemptNav label="Draft" index={index} count={drafts.length} onSelect={layer.select} />
            )}
            <div className="flex flex-wrap gap-2">
                {streaming ? (
                    <button
                        type="button"
                        onClick={generation.abort}
                        className="flex items-center gap-1 rounded-md border px-3 py-2 text-sm"
                    >
                        <Square className="h-3.5 w-3.5" /> Stop
                    </button>
                ) : (
                    <>
                        {shown !== null && (
                            <button
                                type="button"
                                disabled={!shown.trim() || accepting}
                                onClick={() => onAccept(shown.trim())}
                                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                            >
                                {acceptLabel}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => void layer.run()}
                            className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm ${
                                drafts.length ? "border" : "bg-primary text-primary-foreground"
                            }`}
                        >
                            {drafts.length > 0 && <RotateCcw className="h-3.5 w-3.5" />}
                            {drafts.length ? "Try again" : draftLabel}
                        </button>
                        {extra}
                    </>
                )}
            </div>
            {settled && drafts.length > 0 && (
                <RefineInput onRefine={guidance => void layer.run(guidance)} placeholder="Try again with a steer…" />
            )}
        </section>
    );
};
