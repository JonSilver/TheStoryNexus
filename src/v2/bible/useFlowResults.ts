import { useState } from "react";
import type { LorebookEntry } from "@/types/story";
import type { ContinuityIssue, EntryProposal, UpdateProposal } from "./parseProposals";

const addUnique = <T>(current: T[] | null, parsed: T[]): T[] => {
    const seen = new Set((current ?? []).map(item => JSON.stringify(item)));
    return [...(current ?? []), ...parsed.filter(item => !seen.has(JSON.stringify(item)))];
};

/**
 * Review-list state for the bible flows. Results accumulate: running again
 * adds what's new and never discards what the writer already has, or has
 * ticked. Each add returns how many items were new.
 */
export const useFlowResults = (entries: LorebookEntry[]) => {
    const [proposals, setProposals] = useState<EntryProposal[] | null>(null);
    const [updates, setUpdates] = useState<UpdateProposal[] | null>(null);
    const [issues, setIssues] = useState<ContinuityIssue[] | null>(null);
    const [ticked, setTicked] = useState<Set<number>>(new Set());

    const addProposals = (parsed: EntryProposal[]) => {
        const inBible = new Set(entries.map(e => e.name.toLowerCase()));
        const current = proposals ?? [];
        const listed = new Set(current.map(p => p.name.toLowerCase()));
        const fresh = parsed.filter(p => !listed.has(p.name.toLowerCase()));
        setProposals([...current, ...fresh]);
        // New finds start ticked unless the bible already has them
        setTicked(prev => {
            const next = new Set(prev);
            fresh.forEach((p, i) => {
                if (!inBible.has(p.name.toLowerCase())) next.add(current.length + i);
            });
            return next;
        });
        return fresh.length;
    };

    const addIssues = (parsed: ContinuityIssue[]) => {
        const next = addUnique(issues, parsed);
        setIssues(next);
        return next.length - (issues?.length ?? 0);
    };

    const addUpdates = (parsed: UpdateProposal[]) => {
        const next = addUnique(updates, parsed);
        setUpdates(next);
        return next.length - (updates?.length ?? 0);
    };

    const removeUpdate = (applied: UpdateProposal) => setUpdates(current => (current ?? []).filter(u => u !== applied));

    const toggle = (index: number) =>
        setTicked(current => {
            const next = new Set(current);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });

    return {
        proposals,
        updates,
        issues,
        ticked,
        hasResults: proposals !== null || updates !== null || issues !== null,
        addProposals,
        addIssues,
        addUpdates,
        removeUpdate,
        toggle
    };
};
