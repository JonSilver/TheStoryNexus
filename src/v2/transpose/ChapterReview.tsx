import { attemptPromise } from "@jfdi/attempt";
import { useState } from "react";
import type { Chapter } from "@/types/story";
import { useNav } from "../routing";
import { DraftSlot } from "./DraftSlot";
import { machineryIn, piecesOf } from "./pieces";
import { type ChapterDraft, emptyChapter } from "./state";
import type { useChapterDrafting } from "./useChapterDrafting";
import { useDraftEdits } from "./useDraftEdits";

const KEPT_LABELS: Record<string, string> = { horizontalrule: "— scene break —", image: "— image —" };

/**
 * One chapter's transposition for review: its outline in the new setting,
 * then each part of the prose beside the original. Every draft can be
 * flipped, edited or tried again on its own; accepting writes the chapter.
 */
export const ChapterReview = ({
    chapter,
    draft = emptyChapter(),
    drafting
}: {
    chapter: Chapter;
    draft?: ChapterDraft;
    drafting: ReturnType<typeof useChapterDrafting>;
}) => {
    const { goTo } = useNav();
    const [chosen, setChosen] = useState<Record<string, number>>({});
    // Keys: "outline:<draft>" and "piece:<part>:<draft>"
    const { edits, edit } = useDraftEdits<string, string>(async (key, text) => {
        const [slot, a, b] = key.split(":");
        const [error] = await attemptPromise(() =>
            drafting.apply.mutateAsync(
                slot === "outline"
                    ? { op: "editOutlineDraft", chapterId: chapter.id, index: Number(a), text }
                    : { op: "editPieceDraft", chapterId: chapter.id, piece: Number(a), index: Number(b), text }
            )
        );
        return !error;
    });
    const shown = (slot: string, drafts: string[]) => {
        const index = Math.min(chosen[slot] ?? drafts.length - 1, drafts.length - 1);
        return { index, text: index >= 0 ? (edits[`${slot}:${index}`] ?? drafts[index]) : null };
    };

    const pieces = piecesOf(chapter.content);
    const proseCount = pieces.filter(piece => piece.kind === "prose").length;
    const stale =
        draft.pieces.length > 0 &&
        (draft.sourceSaveVersion !== (chapter.saveVersion ?? 0) || draft.pieces.length !== proseCount);
    const piecesNow = stale ? [] : draft.pieces;
    const outline = shown("outline", draft.outlineAttempts);
    const rewrites = Array.from({ length: proseCount }, (_, i) => shown(`piece:${i}`, piecesNow[i] ?? []));
    const complete = outline.text !== null && rewrites.every(rewrite => rewrite.text !== null);
    const machinery = machineryIn(chapter.content);
    const busy = drafting.busy || drafting.apply.isPending;

    if (draft.status === "accepted")
        return (
            <div className="space-y-2 px-4 pb-3 text-sm">
                <p className="text-muted-foreground">Accepted: this chapter now reads in the new setting.</p>
                <button type="button" className="underline" onClick={() => goTo("write", { chapterId: chapter.id })}>
                    Open it in Write
                </button>
            </div>
        );

    const prose = { next: 0 };
    return (
        <div className="space-y-3 px-4 pb-4 text-sm">
            {drafting.errors[chapter.id] && <p className="text-destructive">{drafting.errors[chapter.id]}</p>}
            {stale && (
                <p role="alert" className="rounded-md border border-amber-500/50 bg-amber-500/10 p-2 text-xs">
                    This chapter has changed since its prose was drafted. Draft it again to transpose the text as it is
                    now.
                </p>
            )}
            {machinery > 0 && (
                <p className="text-xs text-muted-foreground">
                    {machinery} unaccepted AI draft{machinery === 1 ? "" : "s"} (scene-beat takes or suggestions) in
                    this chapter won't be carried over.
                </p>
            )}
            <div>
                <p className="mb-1 font-medium">Outline in the new setting</p>
                <DraftSlot
                    label={`Outline of ${chapter.title}`}
                    drafts={draft.outlineAttempts}
                    index={outline.index}
                    shown={outline.text}
                    onSelect={index => setChosen(current => ({ ...current, outline: index }))}
                    onChange={text => edit(`outline:${outline.index}`, text)}
                    onTryAgain={() => void drafting.draftOne(chapter, { outline: true })}
                    busy={busy}
                    minHeight="min-h-24"
                />
            </div>
            {pieces.map((piece, position) => {
                if (piece.kind === "keep")
                    return (
                        <p key={position} className="text-center text-xs text-muted-foreground">
                            {KEPT_LABELS[String(piece.node.type)] ?? "— kept as it is —"}
                        </p>
                    );
                const index = prose.next++;
                const rewrite = rewrites[index];
                return (
                    <div key={position} className="grid gap-2 md:grid-cols-2">
                        <div className="max-h-64 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
                            {piece.text}
                        </div>
                        <DraftSlot
                            label={`Part ${index + 1} of ${chapter.title}`}
                            drafts={piecesNow[index] ?? []}
                            index={rewrite.index}
                            shown={rewrite.text}
                            onSelect={at => setChosen(current => ({ ...current, [`piece:${index}`]: at }))}
                            onChange={text => edit(`piece:${index}:${rewrite.index}`, text)}
                            onTryAgain={() => void drafting.draftOne(chapter, { piece: index })}
                            busy={busy || draft.outlineAttempts.length === 0}
                        />
                    </div>
                );
            })}
            <p className="text-xs text-muted-foreground">
                Rewritten parts come back as plain paragraphs: bold and italics inside them aren't kept.
            </p>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    disabled={!complete || stale || busy}
                    onClick={() =>
                        drafting.apply.mutate({
                            op: "acceptChapter",
                            chapterId: chapter.id,
                            outline: outline.text ?? "",
                            rewrites: rewrites.map(rewrite => rewrite.text ?? "")
                        })
                    }
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                >
                    Accept this chapter
                </button>
                {(!complete || stale) && (
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void drafting.draftOne(chapter)}
                        className="rounded-md border px-3 py-2 disabled:opacity-50"
                    >
                        {complete || stale ? "Draft it again" : "Draft what's missing"}
                    </button>
                )}
            </div>
        </div>
    );
};
