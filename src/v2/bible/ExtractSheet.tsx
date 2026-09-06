import { useState } from "react";
import { attemptPromise } from "@jfdi/attempt";
import { Loader2, X } from "lucide-react";
import { toast } from "react-toastify";
import { useCreateLorebookMutation, useUpdateLorebookMutation } from "@/features/lorebook/hooks/useLorebookQuery";
import type { LorebookEntry } from "@/types/story";
import { useActionGeneration } from "../ai/useActionGeneration";
import {
    type ContinuityIssue,
    type EntryProposal,
    type UpdateProposal,
    parseContinuityIssues,
    parseEntryProposals,
    parseUpdateProposals
} from "./parseProposals";
import { randomUUID } from "@/utils/crypto";

export type BibleFlowMode = "extract-chapter" | "extract-paste" | "updates" | "continuity";

const TITLES: Record<BibleFlowMode, string> = {
    "extract-chapter": "Extract entries from this chapter",
    "extract-paste": "Extract entries from pasted text",
    updates: "Scan chapter for entry updates",
    continuity: "Check chapter continuity against the bible"
};

/**
 * Review-before-save flow (contracts Phase 6): nothing the model proposes
 * is written to the bible without explicit approval.
 */
export const ExtractSheet = ({
    mode,
    storyId,
    chapterId,
    entries,
    onClose
}: {
    mode: BibleFlowMode;
    storyId: string;
    chapterId: string | null;
    entries: LorebookEntry[];
    onClose: () => void;
}) => {
    const generation = useActionGeneration();
    const createEntry = useCreateLorebookMutation();
    const updateEntry = useUpdateLorebookMutation();
    const [pasted, setPasted] = useState("");
    const [proposals, setProposals] = useState<EntryProposal[] | null>(null);
    const [updates, setUpdates] = useState<UpdateProposal[] | null>(null);
    const [issues, setIssues] = useState<ContinuityIssue[] | null>(null);
    const [ticked, setTicked] = useState<Set<number>>(new Set());
    const [approving, setApproving] = useState(false);

    const run = async () => {
        const actionId =
            mode === "updates" ? "propose_updates" : mode === "continuity" ? "check_continuity" : "extract_entries";
        const text = await generation.run({
            actionId,
            storyId,
            ...(mode !== "extract-paste" && chapterId ? { chapterId } : {}),
            editorContext: mode === "extract-paste" ? { userMessage: pasted } : {}
        });
        if (!text) return;
        if (mode === "continuity") {
            const parsed = parseContinuityIssues(text);
            setIssues(parsed);
            if (!parsed.length) toast.success("No continuity issues found");
            return;
        }
        if (mode === "updates") {
            const parsed = parseUpdateProposals(text);
            setUpdates(parsed);
            if (!parsed.length) toast.info("No entry updates suggested");
        } else {
            // Dedupe within the batch and against the existing bible
            // (case-insensitive on name); existing ones start unticked
            const existingNames = new Set(entries.map(e => e.name.toLowerCase()));
            const seen = new Set<string>();
            const parsed = parseEntryProposals(text).filter(proposal => {
                const key = proposal.name.toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            setProposals(parsed);
            setTicked(new Set(parsed.map((proposal, i) => (existingNames.has(proposal.name.toLowerCase()) ? -1 : i)).filter(i => i >= 0)));
            if (!parsed.length) toast.info("Nothing extractable found");
        }
    };

    const approveEntries = async () => {
        if (approving) return;
        setApproving(true);
        const chosen = (proposals ?? []).filter((_, i) => ticked.has(i));
        const results = await Promise.allSettled(
            chosen.map(proposal =>
                createEntry.mutateAsync({
                    id: randomUUID(),
                    level: "story",
                    scopeId: storyId,
                    name: proposal.name,
                    description: proposal.description,
                    category: proposal.category,
                    tags: proposal.tags,
                    isDisabled: false
                })
            )
        );
        const added = results.filter(r => r.status === "fulfilled").length;
        const failed = results.length - added;
        if (failed) toast.error(`${added} added, ${failed} failed — the failures were not saved`);
        else toast.success(`${added} entr${added === 1 ? "y" : "ies"} added`);
        onClose();
    };

    const applyUpdate = async (proposal: UpdateProposal) => {
        const entry = entries.find(e => e.name.toLowerCase() === proposal.name.toLowerCase());
        if (!entry) {
            toast.error(`No entry named “${proposal.name}”`);
            return;
        }
        // Removed from the list only once the write succeeds, so a failure
        // leaves the proposal available to retry
        const [error] = await attemptPromise(() =>
            updateEntry.mutateAsync({ id: entry.id, data: { description: proposal.updatedDescription } })
        );
        if (error) {
            toast.error(`Couldn't update “${proposal.name}”`);
            return;
        }
        setUpdates(current => (current ?? []).filter(u => u !== proposal));
    };

    const busy = generation.phase === "streaming";
    const needsPaste = mode === "extract-paste" && proposals === null;
    const showRun = proposals === null && updates === null && issues === null;

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-label={TITLES[mode]}>
            <div className="flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                <header className="flex items-center justify-between px-4 py-3">
                    <span className="font-medium">{TITLES[mode]}</span>
                    <button type="button" onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="min-h-[10rem] flex-1 space-y-3 overflow-y-auto px-4 pb-4 text-sm">
                    {needsPaste && (
                        <textarea
                            className="min-h-40 w-full resize-y rounded-md border bg-background p-2"
                            placeholder="Paste story text here…"
                            value={pasted}
                            onChange={e => setPasted(e.target.value)}
                        />
                    )}
                    {busy && (
                        <p className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" /> Reading…
                        </p>
                    )}
                    {generation.error && <p className="text-destructive">{generation.error}</p>}

                    {proposals?.map((proposal, index) => (
                        <label key={index} className="flex items-start gap-2 rounded-md border p-2">
                            <input
                                type="checkbox"
                                checked={ticked.has(index)}
                                onChange={() =>
                                    setTicked(current => {
                                        const next = new Set(current);
                                        if (next.has(index)) next.delete(index);
                                        else next.add(index);
                                        return next;
                                    })
                                }
                            />
                            <span>
                                <span className="font-medium">{proposal.name}</span>{" "}
                                <span className="text-xs text-muted-foreground">
                                    ({proposal.category})
                                    {entries.some(e => e.name.toLowerCase() === proposal.name.toLowerCase()) &&
                                        " — already in bible"}
                                </span>
                                <br />
                                {proposal.description}
                                {proposal.tags.length > 0 && (
                                    <span className="block text-xs text-muted-foreground">
                                        aka: {proposal.tags.join(", ")}
                                    </span>
                                )}
                            </span>
                        </label>
                    ))}

                    {issues?.map((issue, index) => (
                        <div key={index} className="space-y-1 rounded-md border border-amber-500/40 p-2">
                            <p className="font-medium">{issue.name}</p>
                            <p>{issue.issue}</p>
                            {issue.evidence && (
                                <p className="text-xs italic text-muted-foreground">“{issue.evidence}”</p>
                            )}
                        </div>
                    ))}
                    {issues?.length === 0 && <p className="text-muted-foreground">Nothing conflicts. Carry on.</p>}

                    {updates?.map(proposal => {
                        const existing = entries.find(e => e.name.toLowerCase() === proposal.name.toLowerCase());
                        return (
                            <div key={proposal.name} className="space-y-1 rounded-md border p-2">
                                <p className="font-medium">{proposal.name}</p>
                                {existing && <p className="text-xs text-muted-foreground line-through">{existing.description}</p>}
                                <p>{proposal.updatedDescription}</p>
                                {proposal.reason && <p className="text-xs text-muted-foreground">{proposal.reason}</p>}
                                <button
                                    type="button"
                                    onClick={() => void applyUpdate(proposal)}
                                    className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground"
                                >
                                    Apply
                                </button>
                            </div>
                        );
                    })}
                </div>

                <footer className="flex gap-2 border-t p-3">
                    {showRun ? (
                        <button
                            type="button"
                            onClick={() => void run()}
                            disabled={busy || (mode === "extract-paste" && !pasted.trim())}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            {busy ? "Working…" : "Run"}
                        </button>
                    ) : proposals !== null ? (
                        <button
                            type="button"
                            onClick={() => void approveEntries()}
                            disabled={ticked.size === 0 || approving}
                            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
                        >
                            Add {ticked.size} to bible
                        </button>
                    ) : null}
                    <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
                        Close
                    </button>
                </footer>
            </div>
        </div>
    );
};
