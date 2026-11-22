import { attempt } from "@jfdi/attempt";

/**
 * Exports omit writing machinery — which is correct for ACCEPTED work, but a
 * take the writer generated and never accepted, or a ghost suggestion still
 * pending, is text they can see on screen that will silently vanish from the
 * book file. Count them so export flows can warn first.
 */

interface RawNode {
    type?: string;
    status?: string;
    takes?: unknown[];
    generatedText?: string;
    text?: string;
    children?: RawNode[];
}

const walk = (node: RawNode, visit: (node: RawNode) => void) => {
    visit(node);
    (node.children ?? []).forEach(child => walk(child, visit));
};

/**
 * `null` when the chapter can't be read: it can't be vouched for, so the
 * export flow must say so rather than count it clean. Empty content is an
 * empty chapter, not an unreadable one.
 */
export const countUndecided = (serialised: string): number | null => {
    if (!serialised.trim()) return 0;
    const [error, parsed] = attempt<{ root?: RawNode } | null>(() => JSON.parse(serialised));
    const root = error ? undefined : parsed?.root;
    if (!root || typeof root !== "object") return null;
    const counts = { undecided: 0 };
    walk(root, node => {
        if (node.type === "scene-beat-v2") {
            const hasDraft = (node.takes?.length ?? 0) > 0 || Boolean(node.generatedText);
            if (hasDraft && node.status !== "accepted") counts.undecided += 1;
        }
        if (node.type === "suggestion-v2" && (node.text ?? "").trim()) counts.undecided += 1;
    });
    return counts.undecided;
};
