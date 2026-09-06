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

export const countUndecided = (serialised: string): number => {
    try {
        const root = (JSON.parse(serialised) as { root?: RawNode }).root;
        if (!root) return 0;
        const counts = { undecided: 0 };
        walk(root, node => {
            if (node.type === "scene-beat-v2") {
                const hasDraft = (node.takes?.length ?? 0) > 0 || Boolean(node.generatedText);
                if (hasDraft && node.status !== "accepted") counts.undecided += 1;
            }
            if (node.type === "suggestion-v2" && (node.text ?? "").trim()) counts.undecided += 1;
        });
        return counts.undecided;
    } catch {
        return 0;
    }
};
