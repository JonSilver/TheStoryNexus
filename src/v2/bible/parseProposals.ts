/**
 * Tolerant parsing of model-returned JSON arrays for bible extraction and
 * update proposals: strips code fences and surrounding prose, validates
 * shapes, and drops malformed items rather than failing wholesale.
 */

export interface EntryProposal {
    name: string;
    category: "character" | "location" | "item" | "event" | "note";
    description: string;
    tags: string[];
}

export interface UpdateProposal {
    name: string;
    updatedDescription: string;
    reason: string;
}

const CATEGORIES = new Set(["character", "location", "item", "event"]);

const extractJsonArray = (text: string): unknown[] | null => {
    const cleaned = text.replace(/```(?:json)?/gi, "");
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end <= start) return null;
    try {
        const parsed = JSON.parse(cleaned.slice(start, end + 1));
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

export const parseEntryProposals = (text: string): EntryProposal[] =>
    (extractJsonArray(text) ?? [])
        .filter(
            (item): item is Record<string, unknown> =>
                !!item &&
                typeof item === "object" &&
                typeof (item as Record<string, unknown>).name === "string" &&
                typeof (item as Record<string, unknown>).description === "string"
        )
        .map(
            (item): EntryProposal => ({
                name: (item.name as string).trim(),
                category: CATEGORIES.has(item.category as string)
                    ? (item.category as EntryProposal["category"])
                    : "note",
                description: (item.description as string).trim(),
                tags: Array.isArray(item.tags) ? (item.tags as unknown[]).filter(t => typeof t === "string") : []
            })
        )
        .filter(item => item.name.length > 0 && item.description.length > 0);

export const parseUpdateProposals = (text: string): UpdateProposal[] =>
    (extractJsonArray(text) ?? [])
        .filter(
            (item): item is Record<string, unknown> =>
                !!item &&
                typeof item === "object" &&
                typeof (item as Record<string, unknown>).name === "string" &&
                typeof (item as Record<string, unknown>).updatedDescription === "string"
        )
        .map(item => ({
            name: (item.name as string).trim(),
            updatedDescription: (item.updatedDescription as string).trim(),
            reason: typeof item.reason === "string" ? item.reason : ""
        }))
        .filter(item => item.name.length > 0 && item.updatedDescription.length > 0);

export interface ContinuityIssue {
    name: string;
    issue: string;
    evidence: string;
}

export const parseContinuityIssues = (text: string): ContinuityIssue[] =>
    (extractJsonArray(text) ?? [])
        .filter(
            (item): item is Record<string, unknown> =>
                !!item &&
                typeof item === "object" &&
                typeof (item as Record<string, unknown>).name === "string" &&
                typeof (item as Record<string, unknown>).issue === "string"
        )
        .map(item => ({
            name: (item.name as string).trim(),
            issue: (item.issue as string).trim(),
            evidence: typeof item.evidence === "string" ? item.evidence : ""
        }))
        .filter(item => item.name.length > 0 && item.issue.length > 0);
