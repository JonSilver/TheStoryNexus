import type { LorebookEntry } from "@/types/story";
import type { BibleFlowMode } from "./ExtractSheet";
import type { ContinuityIssue, EntryProposal, UpdateProposal } from "./parseProposals";

export const FLOW_TITLES: Record<BibleFlowMode, string> = {
    "extract-chapter": "Extract entries from this chapter",
    "extract-story": "Extract entries from the whole story",
    "extract-paste": "Extract entries from pasted text",
    updates: "Scan chapter for entry updates",
    continuity: "Check chapter continuity against the bible"
};

/** Result renderers for the bible flow sheet — presentation only. */

export const ProposalList = ({
    proposals,
    entries,
    ticked,
    onToggle
}: {
    proposals: EntryProposal[];
    entries: LorebookEntry[];
    ticked: Set<number>;
    onToggle: (index: number) => void;
}) => (
    <>
        {proposals.map((proposal, index) => (
            <label key={index} className="flex items-start gap-2 rounded-md border p-2">
                <input type="checkbox" checked={ticked.has(index)} onChange={() => onToggle(index)} />
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
                        <span className="block text-xs text-muted-foreground">aka: {proposal.tags.join(", ")}</span>
                    )}
                </span>
            </label>
        ))}
    </>
);

export const IssueList = ({ issues }: { issues: ContinuityIssue[] }) => (
    <>
        {issues.map((issue, index) => (
            <div key={index} className="space-y-1 rounded-md border border-amber-500/40 p-2">
                <p className="font-medium">{issue.name}</p>
                <p>{issue.issue}</p>
                {issue.evidence && <p className="text-xs italic text-muted-foreground">“{issue.evidence}”</p>}
            </div>
        ))}
        {issues.length === 0 && <p className="text-muted-foreground">Nothing conflicts. Carry on.</p>}
    </>
);

export const UpdateList = ({
    updates,
    entries,
    onApply
}: {
    updates: UpdateProposal[];
    entries: LorebookEntry[];
    onApply: (proposal: UpdateProposal) => void;
}) => (
    <>
        {updates.map(proposal => {
            const existing = entries.find(e => e.name.toLowerCase() === proposal.name.toLowerCase());
            return (
                <div key={proposal.name} className="space-y-1 rounded-md border p-2">
                    <p className="font-medium">{proposal.name}</p>
                    {existing && <p className="text-xs text-muted-foreground line-through">{existing.description}</p>}
                    <p>{proposal.updatedDescription}</p>
                    {proposal.reason && <p className="text-xs text-muted-foreground">{proposal.reason}</p>}
                    <button
                        type="button"
                        onClick={() => onApply(proposal)}
                        className="rounded-md bg-primary px-3 py-1 text-xs text-primary-foreground"
                    >
                        Apply
                    </button>
                </div>
            );
        })}
    </>
);

/** Bible replies are structured: Stop keeps only what can be read as entries. */
export const BIBLE_STOP_NOTE = "Stop ends it; anything that can be read so far is kept.";
