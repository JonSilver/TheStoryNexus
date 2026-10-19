import { useRef, useState } from "react";
import type { LorebookEntry } from "@/types/story";
import {
    type ContinuityIssue,
    type EntryProposal,
    type UpdateProposal,
    parseContinuityIssues,
    parseEntryProposals,
    parseUpdateProposals
} from "./parseProposals";

interface Results {
    proposals: EntryProposal[] | null;
    updates: UpdateProposal[] | null;
    issues: ContinuityIssue[] | null;
    ticked: Set<number>;
}

const EMPTY: Results = { proposals: null, updates: null, issues: null, ticked: new Set() };

const addUnique = <T>(current: T[] | null, parsed: T[]): T[] => {
    const seen = new Set((current ?? []).map(item => JSON.stringify(item)));
    return [...(current ?? []), ...parsed.filter(item => !seen.has(JSON.stringify(item)))];
};

/**
 * Review-list state for the bible flows. Results accumulate: running again
 * adds what's new and never discards what the writer already has, or has
 * ticked. Each add returns how many items were new. Adds read the latest
 * results, not a render's snapshot — a whole-story sweep adds chapter by
 * chapter within one async run.
 */
export const useFlowResults = (entries: LorebookEntry[]) => {
    const [results, setResults] = useState<Results>(EMPTY);
    const latest = useRef(results);
    const commit = (next: Results) => {
        latest.current = next;
        setResults(next);
    };

    const addProposals = (parsed: EntryProposal[]) => {
        const inBible = new Set(entries.map(e => e.name.toLowerCase()));
        const current = latest.current.proposals ?? [];
        // De-duplicated against the list AND within this reply
        const listed = new Set(current.map(p => p.name.toLowerCase()));
        const fresh = parsed.filter(p => {
            const key = p.name.toLowerCase();
            if (listed.has(key)) return false;
            listed.add(key);
            return true;
        });
        // New finds start ticked unless the bible already has them
        const ticked = new Set(latest.current.ticked);
        fresh.forEach((p, i) => {
            if (!inBible.has(p.name.toLowerCase())) ticked.add(current.length + i);
        });
        commit({ ...latest.current, proposals: [...current, ...fresh], ticked });
        return fresh.length;
    };

    const addIssues = (parsed: ContinuityIssue[]) => {
        const before = latest.current.issues?.length ?? 0;
        const issues = addUnique(latest.current.issues, parsed);
        commit({ ...latest.current, issues });
        return issues.length - before;
    };

    const addUpdates = (parsed: UpdateProposal[]) => {
        const before = latest.current.updates?.length ?? 0;
        const updates = addUnique(latest.current.updates, parsed);
        commit({ ...latest.current, updates });
        return updates.length - before;
    };

    const removeUpdate = (applied: UpdateProposal) =>
        commit({ ...latest.current, updates: (latest.current.updates ?? []).filter(u => u !== applied) });

    /** Drops the given proposals (e.g. once added to the bible), keeping the rest and their ticks. */
    const removeProposals = (indexes: Set<number>) => {
        const kept = (latest.current.proposals ?? []).map((p, i) => ({ p, i })).filter(({ i }) => !indexes.has(i));
        const ticked = new Set(kept.flatMap(({ i }, n) => (latest.current.ticked.has(i) ? [n] : [])));
        commit({ ...latest.current, proposals: kept.map(({ p }) => p), ticked });
    };

    const toggle = (index: number) => {
        const ticked = new Set(latest.current.ticked);
        if (ticked.has(index)) ticked.delete(index);
        else ticked.add(index);
        commit({ ...latest.current, ticked });
    };

    /**
     * Adds what a reply yields; returns what to tell the writer, or null. A
     * failed reply still yields whatever parses (it can be complete before its
     * stream fails), but failure is never reported as "nothing found".
     */
    const offerReply = (kind: "entries" | "updates" | "issues", text: string, failed: boolean): string | null => {
        const again =
            latest.current.proposals !== null || latest.current.updates !== null || latest.current.issues !== null;
        if (kind === "issues") {
            const parsed = parseContinuityIssues(text);
            if (failed && !parsed.length) return null;
            return addIssues(parsed) || failed ? null : again ? "Nothing new found" : "No continuity issues found";
        }
        if (kind === "updates") {
            const parsed = parseUpdateProposals(text);
            if (failed && !parsed.length) return null;
            return addUpdates(parsed) || failed ? null : again ? "Nothing new suggested" : "No entry updates suggested";
        }
        const parsed = parseEntryProposals(text);
        if (failed && !parsed.length) return null;
        if (addProposals(parsed) || failed) return null;
        if (!parsed.length && text.trim().length > 40)
            return "The reply couldn't be read as entries — the model may have run out of tokens. Try again or raise max tokens for this action.";
        return again ? "Nothing new found" : "Nothing extractable found";
    };

    return {
        ...results,
        offerReply,
        hasResults: results.proposals !== null || results.updates !== null || results.issues !== null,
        addProposals,
        addIssues,
        addUpdates,
        removeUpdate,
        removeProposals,
        toggle
    };
};
