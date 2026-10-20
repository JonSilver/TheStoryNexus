import { attemptPromise } from "@jfdi/attempt";
import { useEffect, useRef, useState } from "react";
import { useTranspositionOpMutation } from "@/features/transpositions/hooks/useTranspositionQuery";
import type { AnsweredModel } from "@/types/actions";
import { useActionGeneration } from "../ai/useActionGeneration";
import { parseTransposedEntry } from "./parseEntry";
import type { EntryValue, Transposition } from "./state";

type Draft = Omit<EntryValue, "category">;

const describeEntry = ({ name, category, description, tags }: EntryValue) =>
    [`Name: ${name}`, `Category: ${category}`, tags.length ? `Also called: ${tags.join(", ")}` : "", description]
        .filter(Boolean)
        .join("\n");

const UNREADABLE =
    "The reply wasn't in a form that could be read as an entry, so it's kept below as written — edit it into the entry, or try again.";

// The most a draft's description can be (the server's limit)
const MAX_DESCRIPTION = 50_000;

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
    /** The model each entry's latest run used, so its card names (and changes) the right one. */
    const [modelOf, setModelOf] = useState<Record<string, AnsweredModel>>({});
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
        const result = await generation.run({
            actionId: "transpose_entry",
            storyId,
            editorContext: { userMessage: describeEntry(entry.original), ...(guidance && { guidance }) }
        });
        setRunning(null);
        if (result.outcome === "superseded") return null;
        const { model } = result;
        if (model) setModelOf(current => ({ ...current, [entryId]: model }));
        const value = parseTransposedEntry(result.text);
        // Stopped part-way: the writer's choice, not a model that can't do the job
        if (result.outcome === "stopped" && !value) return null;
        const error =
            result.outcome === "failed" ? (result.error ?? "failed") : !value && result.text.trim() ? UNREADABLE : null;
        if (error) setErrors(current => ({ ...current, [entryId]: error }));
        // What the model wrote is kept even when it can't be read as an entry: as a draft, as written
        const reply = result.text.trim();
        const next: Draft | null =
            value ??
            (reply
                ? { name: entry.original.name, description: reply.slice(0, MAX_DESCRIPTION), tags: entry.original.tags }
                : null);
        if (!next) return error;
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

    return {
        storyId,
        generation,
        modelOf,
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
