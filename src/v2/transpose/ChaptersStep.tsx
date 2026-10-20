import { ChevronDown, ChevronRight, Square } from "lucide-react";
import { useState } from "react";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { ChapterReview } from "./ChapterReview";
import type { Transposition } from "./state";
import { useChapterDrafting } from "./useChapterDrafting";

const statusOf = (transposition: Transposition, chapterId: string) => {
    const draft = transposition.state.chapters[chapterId];
    if (draft?.status === "accepted") return "Accepted";
    if (draft?.pieces.some(drafts => drafts.length)) return "Drafted — to review";
    if (draft?.outlineAttempts.length) return "Outline drafted";
    return "Not drafted yet";
};

/**
 * The chapters, in order: each is drafted (its outline, then its prose part
 * by part) and reviewed beside the original, then accepted. Drafting the
 * remaining chapters runs through the book; Stop keeps everything drafted.
 */
export const ChaptersStep = ({ transposition }: { transposition: Transposition }) => {
    const { data: chapters = [], isLoading } = useChaptersByStoryQuery(transposition.storyId);
    const drafting = useChapterDrafting(transposition);
    const remaining = chapters.filter(chapter => transposition.state.chapters[chapter.id]?.status !== "accepted");
    const [openId, setOpenId] = useState<string | null>(null);
    // The first chapter still to do is open unless the writer opened another
    const open = openId ?? remaining[0]?.id ?? null;
    const { progress } = drafting;

    if (isLoading) return <p className="p-4 text-sm text-muted-foreground">Loading chapters…</p>;
    return (
        <section className="py-2">
            <div className="space-y-2 px-4 py-2 text-sm">
                <p className="text-muted-foreground">
                    Each chapter is drafted in the new setting, outline first, then its prose part by part, using the
                    brief, the bible and the chapters before it. Review each part beside the original, then accept the
                    chapter. {chapters.length - remaining.length} of {chapters.length} accepted.
                </p>
                {progress ? (
                    <div className="flex items-center gap-2">
                        <p role="status" className="flex-1">
                            Chapter {progress.chapter} of {progress.chapters}: “{progress.title}” —{" "}
                            {progress.piece === null
                                ? "the outline"
                                : `part ${progress.piece + 1} of ${progress.pieces}`}
                        </p>
                        <button
                            type="button"
                            onClick={drafting.stop}
                            className="flex items-center gap-1 rounded-md border px-3 py-1.5"
                        >
                            <Square className="h-3.5 w-3.5" /> Stop
                        </button>
                    </div>
                ) : (
                    remaining.length > 0 && (
                        <button
                            type="button"
                            disabled={drafting.apply.isPending}
                            onClick={() => void drafting.sweep(remaining)}
                            className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
                        >
                            {remaining.length === chapters.length
                                ? "Draft all the chapters"
                                : `Draft the ${remaining.length} remaining chapter${remaining.length === 1 ? "" : "s"}`}
                        </button>
                    )
                )}
                {drafting.sweepFailure && <p className="text-destructive">{drafting.sweepFailure}</p>}
            </div>
            <ul className="divide-y border-y">
                {chapters.map(chapter => (
                    <li key={chapter.id} aria-label={chapter.title}>
                        <button
                            type="button"
                            aria-expanded={open === chapter.id}
                            onClick={() => setOpenId(open === chapter.id ? "" : chapter.id)}
                            className="flex w-full items-center gap-2 px-4 py-3 text-left"
                        >
                            {open === chapter.id ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="flex-1 font-medium">{chapter.title}</span>
                            <span className="text-xs text-muted-foreground">{statusOf(transposition, chapter.id)}</span>
                        </button>
                        {open === chapter.id && (
                            <ChapterReview
                                chapter={chapter}
                                draft={transposition.state.chapters[chapter.id]}
                                drafting={drafting}
                            />
                        )}
                    </li>
                ))}
            </ul>
            <div className="px-4 py-3">
                <button
                    type="button"
                    disabled={remaining.length > 0 || drafting.apply.isPending}
                    onClick={() => drafting.apply.mutate({ op: "finishChapters" })}
                    className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                >
                    Finish the transposition
                </button>
            </div>
        </section>
    );
};
