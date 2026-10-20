import { attemptPromise } from "@jfdi/attempt";
import { useEffect, useRef, useState } from "react";
import { useTranspositionOpMutation } from "@/features/transpositions/hooks/useTranspositionQuery";
import { useActionGeneration } from "../ai/useActionGeneration";
import { parseTransposedEntry } from "./parseEntry";
import type { EntryValue, Transposition } from "./state";

type Draft = Omit<EntryValue, "category">;

const describeEntry = ({ name, category, description, tags }: EntryValue) =>
    [`Name: ${name}`, `Category: ${category}`, tags.length ? `Also called: ${tags.join(", ")}` : "", description]
        .filter(Boolean)
        .join("\n");

const UNREADABLE = "The reply wasn't in a form that could be read as an entry. What the model sent is below.";

// Two entries failing in a row means the model or server is broken, not the entry
const MAX_CONSECUTIVE_FAILURES = 2;

/**
 * Drafts transposed bible entries, one or all of them in turn. Each draft is
 * stored as it arrives; one the server couldn't take waits here to be saved
 * again. Stop (or leaving the screen) ends a sweep after the current entry.
 */
export const useEntryDrafting = (transposition: Transposition) => {
    const { storyId, state } = transposition;
    const generation = useActionGeneration();
    const apply = useTranspositionOpMutation(storyId);
    const [running, setRunning] = useState<string | null>(null);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [unsaved, setUnsaved] = useState<Record<string, Draft[]>>({});
    /** Replies that couldn't be read as an entry: still the writer's to use. */
    const [unreadable, setUnreadable] = useState<Record<string, string>>({});
    const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);
    const [sweepFailure, setSweepFailure] = useState<string | null>(null);
    const stopRequested = useRef(false);
    useEffect(
        () => () => {
            stopRequested.current = true;
        },
        []
    );

    const keep = async (entryId: string, value: Draft) => {
        const [error] = await attemptPromise(() => apply.mutateAsync({ op: "addEntryAttempt", entryId, value }));
        if (!error)
            setUnsaved(current => ({ ...current, [entryId]: (current[entryId] ?? []).filter(d => d !== value) }));
    };

    /** Drafts one entry; resolves the error, or null when a draft arrived. */
    const draft = async (entryId: string, guidance?: string): Promise<string | null> => {
        const entry = state.entries[entryId];
        if (!entry) return null;
        setRunning(entryId);
        setErrors(({ [entryId]: _cleared, ...rest }) => rest);
        setUnreadable(({ [entryId]: _cleared, ...rest }) => rest);
        const result = await generation.run({
            actionId: "transpose_entry",
            storyId,
            editorContext: { userMessage: describeEntry(entry.original), ...(guidance && { guidance }) }
        });
        setRunning(null);
        if (result.outcome === "superseded") return null;
        const value = parseTransposedEntry(result.text);
        // Stopped part-way: the writer's choice, not a model that can't do the job
        if (result.outcome === "stopped" && !value) return null;
        const error =
            result.outcome === "failed" ? (result.error ?? "failed") : !value && result.text.trim() ? UNREADABLE : null;
        if (error) setErrors(current => ({ ...current, [entryId]: error }));
        if (!value && result.text.trim()) setUnreadable(current => ({ ...current, [entryId]: result.text.trim() }));
        if (!value) return error;
        const next: Draft = value;
        setUnsaved(current => ({ ...current, [entryId]: [...(current[entryId] ?? []), next] }));
        await keep(entryId, next);
        return error;
    };

    /** Every entry not yet drafted, in turn. */
    const sweep = async () => {
        stopRequested.current = false;
        setSweepFailure(null);
        const todo = state.entryOrder.filter(
            id => state.entries[id].status === "pending" && !state.entries[id].attempts.length
        );
        const streak = { failed: 0, last: "" };
        for (const [index, id] of todo.entries()) {
            if (stopRequested.current || streak.failed >= MAX_CONSECUTIVE_FAILURES) break;
            setProgress({ current: index + 1, total: todo.length, name: state.entries[id].original.name });
            const error = await draft(id);
            streak.failed = error ? streak.failed + 1 : 0;
            streak.last = error ?? streak.last;
        }
        setProgress(null);
        if (streak.failed >= MAX_CONSECUTIVE_FAILURES)
            setSweepFailure(`Stopped after two entries in a row failed — ${streak.last} Fix that, then run again.`);
    };

    const stop = () => {
        stopRequested.current = true;
        generation.abort();
    };

    /** What the model sent, as a draft to edit: the entry's name, and the reply as its description. */
    const takeReply = async (entryId: string) => {
        const reply = unreadable[entryId];
        const entry = state.entries[entryId];
        if (!reply || !entry) return;
        const next: Draft = { name: entry.original.name, description: reply, tags: entry.original.tags };
        setUnsaved(current => ({ ...current, [entryId]: [...(current[entryId] ?? []), next] }));
        setUnreadable(({ [entryId]: _used, ...rest }) => rest);
        setErrors(({ [entryId]: _cleared, ...rest }) => rest);
        await keep(entryId, next);
    };

    return {
        storyId,
        generation,
        unreadable,
        takeReply,
        running,
        errors,
        unsaved,
        saveAgain: (entryId: string) => (unsaved[entryId] ?? []).forEach(value => void keep(entryId, value)),
        progress,
        sweepFailure,
        draft,
        sweep,
        stop,
        apply
    };
};
