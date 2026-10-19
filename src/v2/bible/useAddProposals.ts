import { useCreateLorebookMutation } from "@/features/lorebook/hooks/useLorebookQuery";
import { randomUUID } from "@/utils/crypto";
import type { EntryProposal } from "./parseProposals";

/**
 * Approved proposals become story entries. Resolves which ones landed, in
 * order, so failures can stay listed to retry — the list is paid-for work.
 */
export const useAddProposals = (storyId: string) => {
    const createEntry = useCreateLorebookMutation({ reportsOwnFailures: true });
    return async (chosen: EntryProposal[]): Promise<boolean[]> => {
        const settled = await Promise.allSettled(
            chosen.map(({ name, description, category, tags }) =>
                createEntry.mutateAsync({
                    id: randomUUID(),
                    level: "story",
                    scopeId: storyId,
                    name,
                    description,
                    category,
                    tags,
                    isDisabled: false
                })
            )
        );
        return settled.map(result => result.status === "fulfilled");
    };
};
