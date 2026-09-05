/**
 * Revision-aware chapter update resolution.
 * expectedRevision is opt-in: clients that send it get optimistic-concurrency
 * protection (409 on mismatch); legacy clients keep last-write-wins.
 * Content changes bump the revision; other field updates do not.
 */
type ChapterUpdateBody = Record<string, unknown> & { expectedRevision?: number };

export type ChapterUpdateResolution =
    | { outcome: "conflict"; currentRevision: number }
    | { outcome: "apply"; updates: Record<string, unknown> };

export const resolveChapterUpdate = (
    currentRevision: number,
    body: ChapterUpdateBody,
    now: Date
): ChapterUpdateResolution => {
    const { id: _id, createdAt: _createdAt, revision: _revision, expectedRevision, ...updates } = body;

    if (expectedRevision !== undefined && expectedRevision !== currentRevision)
        return { outcome: "conflict", currentRevision };

    const contentChanging = Object.prototype.hasOwnProperty.call(updates, "content");
    return {
        outcome: "apply",
        updates: {
            ...updates,
            updatedAt: now,
            ...(contentChanging && { revision: currentRevision + 1 })
        }
    };
};
