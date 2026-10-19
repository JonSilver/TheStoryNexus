/**
 * Chat update resolution. A write that replaces `messages` must say which
 * revision it was built on: a stale one is a conflict (the client re-applies
 * its own changes to the current conversation and retries), never a silent
 * overwrite of another device's turns. Other fields (title) are plain updates.
 */
type ChatUpdateBody = Record<string, unknown> & { expectedRevision?: unknown };

type ChatUpdateResolution =
    | { outcome: "conflict" }
    | { outcome: "apply"; updates: Record<string, unknown>; guarded: boolean };

const SERVER_MANAGED = new Set(["id", "storyId", "createdAt", "revision", "expectedRevision"]);

export const resolveChatUpdate = (currentRevision: number, body: ChatUpdateBody, now: Date): ChatUpdateResolution => {
    const { expectedRevision } = body;
    const updates = Object.fromEntries(Object.entries(body).filter(([key]) => !SERVER_MANAGED.has(key)));
    if (!Object.prototype.hasOwnProperty.call(updates, "messages"))
        return { outcome: "apply", updates: { ...updates, updatedAt: now }, guarded: false };
    if (typeof expectedRevision !== "number" || expectedRevision !== currentRevision) return { outcome: "conflict" };
    return { outcome: "apply", updates: { ...updates, updatedAt: now, revision: currentRevision + 1 }, guarded: true };
};
