import { useState } from "react";
import { useTranspositionOpMutation } from "@/features/transpositions/hooks/useTranspositionQuery";
import type { Transposition } from "./state";

/**
 * The accepted brief, after the brief step: there to read, and to revise —
 * every later step is written against it as it is now (drafts already made
 * keep what they were written with).
 */
export const BriefPanel = ({ transposition }: { transposition: Transposition }) => {
    const apply = useTranspositionOpMutation(transposition.storyId);
    const [draft, setDraft] = useState<string | null>(null);
    const brief = transposition.brief ?? "";
    const text = draft ?? brief;
    return (
        <details className="border-b px-4 py-2 text-sm">
            <summary className="cursor-pointer text-muted-foreground">The brief</summary>
            <textarea
                aria-label="The accepted brief"
                className="mt-2 min-h-48 w-full resize-y rounded-md border bg-background p-2 text-sm leading-relaxed"
                value={text}
                onChange={e => setDraft(e.target.value)}
            />
            <div className="mt-1 flex items-center gap-2">
                <button
                    type="button"
                    disabled={draft === null || !text.trim() || text === brief || apply.isPending}
                    onClick={() =>
                        apply.mutate({ op: "reviseBrief", brief: text.trim() }, { onSuccess: () => setDraft(null) })
                    }
                    className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground disabled:opacity-50"
                >
                    Save the brief
                </button>
                <span className="text-xs text-muted-foreground">
                    Later steps follow the brief as saved; drafts already made keep what they were written with.
                </span>
            </div>
        </details>
    );
};
