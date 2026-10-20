import { attemptPromise } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranspositionOpMutation } from "@/features/transpositions/hooks/useTranspositionQuery";
import { chaptersApi } from "@/services/api/client";
import { chaptersKeys } from "@/services/api/queryKeys";
import type { Chapter } from "@/types/story";
import { useActionGeneration } from "../ai/useActionGeneration";
import { flushChapterSave } from "../editor/useChapterSaver";
import { piecesOf, prosePieces } from "./pieces";
import { emptyChapter, lastComplete, type Transposition } from "./state";

export interface ChapterProgress {
    chapter: number;
    chapters: number;
    title: string;
    /** The piece being drafted, once the outline is done. */
    piece: number | null;
    pieces: number;
}

const last = <T>(list: T[]): T | undefined => list[list.length - 1];

// Enough of the previous rewrite to carry voice and continuity into the next piece
const CONTINUITY_CHARS = 2000;

// Two chapters failing in a row means the model or server is broken, not the chapter
const MAX_CONSECUTIVE_FAILURES = 2;

/**
 * Drafts transposed chapters: first the outline, then each piece of prose
 * against it, every draft stored as it arrives. Only what isn't drafted yet
 * is drafted — Stop, or leaving the screen, and coming back carries on where
 * it stopped. A chapter edited since its pieces were drafted starts them afresh.
 */
export const useChapterDrafting = (transposition: Transposition) => {
    const { storyId } = transposition;
    const queryClient = useQueryClient();
    const generation = useActionGeneration();
    const apply = useTranspositionOpMutation(storyId);
    const [progress, setProgress] = useState<ChapterProgress | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [sweepFailure, setSweepFailure] = useState<string | null>(null);
    const stopRequested = useRef(false);
    useEffect(
        () => () => {
            stopRequested.current = true;
        },
        []
    );

    /** The chapter as saved now — the text the model must transpose. */
    const freshChapter = async (chapterId: string) => {
        await flushChapterSave(chapterId);
        const [, chapter] = await attemptPromise(() =>
            queryClient.fetchQuery({
                queryKey: chaptersKeys.detail(chapterId),
                queryFn: () => chaptersApi.getById(chapterId),
                staleTime: 0
            })
        );
        return chapter ?? null;
    };

    const generate = async (request: Parameters<typeof generation.run>[0]) => {
        const result = await generation.run(request);
        const text = result.text.trim();
        // Stopped (or replaced) before anything arrived: nothing to keep, and nothing went wrong
        const ended = result.outcome === "superseded" || (result.outcome === "stopped" && !text);
        const error =
            result.outcome === "failed"
                ? (result.error ?? "failed")
                : !text && !ended
                  ? "the model sent no text."
                  : null;
        // Cut short (a failure, or the writer's Stop): kept, but not a whole draft
        return { text, error, ended, incomplete: result.outcome !== "complete" };
    };

    /** Records a draft; returns the transposition as it now stands, or null when it couldn't be kept. */
    const record = async (op: Parameters<typeof apply.mutateAsync>[0]) => {
        const [, saved] = await attemptPromise(() => apply.mutateAsync(op));
        return saved ?? null;
    };

    /**
     * Drafts whatever this chapter is missing, or (with `only`) one part of it
     * again. Resolves the error, or null.
     */
    const draft = async (
        chapter: Pick<Chapter, "id" | "title">,
        position: { chapter: number; chapters: number },
        only?: { outline: true; guidance?: string } | { piece: number; guidance?: string },
        /** The outline the writer has on screen, when they pressed for one chapter. */
        chosenOutline?: string
    ): Promise<string | null> => {
        const fail = (error: string) => {
            setErrors(current => ({ ...current, [chapter.id]: error }));
            return error;
        };
        setErrors(({ [chapter.id]: _cleared, ...rest }) => rest);
        const source = await freshChapter(chapter.id);
        if (!source) return fail("Couldn't read the chapter to transpose it.");
        const pieces = prosePieces(piecesOf(source.content));
        const sourceSaveVersion = source.saveVersion ?? 0;
        const current = { state: transposition.state };
        const draftOf = () => current.state.chapters[chapter.id] ?? emptyChapter();
        const pov = {
            ...(source.povCharacter && { povCharacter: source.povCharacter }),
            ...(source.povType && { povType: source.povType })
        };
        const show = (piece: number | null) =>
            setProgress({ ...position, title: chapter.title, piece, pieces: pieces.length });

        const outlineFits = () =>
            draftOf().outlineSourceSaveVersion === sourceSaveVersion && lastComplete(draftOf().outlineAttempts);
        const needsOutline = only ? "outline" in only : !chosenOutline && !outlineFits();
        if (needsOutline) {
            show(null);
            const guidance = only && "outline" in only ? only.guidance : undefined;
            const outcome = await generate({
                actionId: "transpose_outline",
                storyId,
                chapterId: chapter.id,
                editorContext: guidance ? { guidance } : {}
            });
            const saved = outcome.text
                ? await record({
                      op: "addOutlineAttempt",
                      chapterId: chapter.id,
                      sourceSaveVersion,
                      text: outcome.text,
                      ...(outcome.incomplete && { incomplete: true as const })
                  })
                : null;
            if (saved) current.state = saved.state;
            if (outcome.ended) return null;
            if (outcome.error) return fail(`The outline: ${outcome.error}`);
            if (!saved) return fail("The outline couldn't be saved — try again.");
            if (outcome.incomplete) return fail("The outline was cut short — try it again.");
        }
        if (only && "outline" in only) return null;

        const outline = chosenOutline ?? lastComplete(draftOf().outlineAttempts)?.text ?? "";
        const fitsSource = (draft: ReturnType<typeof draftOf>) =>
            draft.sourceSaveVersion === sourceSaveVersion && draft.pieces.length === pieces.length;
        const todo = only
            ? ["piece" in only ? only.piece : -1].filter(i => i >= 0 && i < pieces.length)
            : pieces.map((_, i) => i).filter(i => !fitsSource(draftOf()) || !lastComplete(draftOf().pieces[i] ?? []));
        for (const index of todo) {
            if (stopRequested.current) break;
            show(index);
            const previous =
                index > 0 && fitsSource(draftOf()) ? last(draftOf().pieces[index - 1] ?? [])?.text : undefined;
            const outcome = await generate({
                actionId: "transpose_prose",
                storyId,
                chapterId: chapter.id,
                editorContext: {
                    ...pov,
                    selection: pieces[index].text,
                    userMessage: outline,
                    ...(previous && { recentProse: previous.slice(-CONTINUITY_CHARS) }),
                    ...(only && "piece" in only && only.guidance && { guidance: only.guidance })
                }
            });
            const saved = outcome.text
                ? await record({
                      op: "addPieceAttempt",
                      chapterId: chapter.id,
                      sourceSaveVersion,
                      pieceCount: pieces.length,
                      index,
                      text: outcome.text,
                      ...(outcome.incomplete && { incomplete: true as const })
                  })
                : null;
            if (saved) current.state = saved.state;
            if (outcome.ended) return null;
            const where = `Part ${index + 1} of ${pieces.length}`;
            if (outcome.error)
                return fail(`${where}: ${outcome.error}${outcome.text ? " What arrived is kept, incomplete." : ""}`);
            if (!saved) return fail(`${where} couldn't be saved — try again.`);
            if (outcome.incomplete) return fail(`${where} was cut short — what arrived is kept, marked incomplete.`);
        }
        return null;
    };

    const run = async (work: () => Promise<unknown>) => {
        stopRequested.current = false;
        setSweepFailure(null);
        await work();
        setProgress(null);
    };

    /** Every chapter not yet accepted, in order, drafting only what's missing. */
    const sweep = (chapters: Array<Pick<Chapter, "id" | "title">>) =>
        run(async () => {
            const todo = chapters.filter(chapter => transposition.state.chapters[chapter.id]?.status !== "accepted");
            const streak = { failed: 0, last: "" };
            for (const [index, chapter] of todo.entries()) {
                if (stopRequested.current || streak.failed >= MAX_CONSECUTIVE_FAILURES) break;
                const error = await draft(chapter, { chapter: index + 1, chapters: todo.length });
                streak.failed = error ? streak.failed + 1 : 0;
                streak.last = error ?? streak.last;
            }
            if (streak.failed >= MAX_CONSECUTIVE_FAILURES)
                setSweepFailure(`Stopped after two chapters in a row failed — ${streak.last} Fix that, then carry on.`);
        });

    return {
        generation,
        progress,
        errors,
        sweepFailure,
        apply,
        sweep,
        /** One chapter (or one part of it) on its own. */
        draftOne: (
            chapter: Pick<Chapter, "id" | "title">,
            only?: { outline: true; guidance?: string } | { piece: number; guidance?: string },
            chosenOutline?: string
        ) => run(() => draft(chapter, { chapter: 1, chapters: 1 }, only, chosenOutline)),
        stop: () => {
            stopRequested.current = true;
            generation.abort();
        },
        busy: progress !== null
    };
};
