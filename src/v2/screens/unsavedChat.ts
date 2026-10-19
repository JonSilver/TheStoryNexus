import type { ChatMessage } from "@/types/story";

/**
 * A conversation the server refused to save is kept in this browser until it
 * is saved — leaving the screen or reloading must not lose a paid-for reply.
 * It's kept as what the server had (`base`) and what this device wanted
 * (`local`), so only THIS device's changes are ever replayed: anything saved
 * since, from here or another device, is never overwritten, reordered or
 * second-guessed. Memory backs storage up where it's unavailable.
 */
export interface UnsavedChat {
    base: ChatMessage[];
    local: ChatMessage[];
}

const UNSAVED_PREFIX = "storynexus-unsaved-chat:";
const unsavedInMemory = new Map<string, UnsavedChat>();

export const readUnsaved = (chatId: string): UnsavedChat | null => {
    try {
        const raw = localStorage.getItem(UNSAVED_PREFIX + chatId);
        if (raw) {
            const parsed = JSON.parse(raw) as UnsavedChat | ChatMessage[];
            // An early build stored the list alone: every message counts as this device's own
            return Array.isArray(parsed) ? { base: [], local: parsed } : parsed;
        }
    } catch {
        // Unreadable storage: fall back to this session's copy
    }
    return unsavedInMemory.get(chatId) ?? null;
};

export const writeUnsaved = (chatId: string, unsaved: UnsavedChat | null) => {
    if (unsaved) unsavedInMemory.set(chatId, unsaved);
    else unsavedInMemory.delete(chatId);
    try {
        if (unsaved) localStorage.setItem(UNSAVED_PREFIX + chatId, JSON.stringify(unsaved));
        else localStorage.removeItem(UNSAVED_PREFIX + chatId);
    } catch {
        // Storage unavailable or full: the in-memory copy still covers this session
    }
};

const versionsOf = (message: ChatMessage) => message.versions ?? [message.content];
const shownOf = (message: ChatMessage) =>
    message.shownVersion ?? (message.versions ? Math.max(0, message.versions.lastIndexOf(message.content)) : 0);

/**
 * This device's change to a message both sides have: versions it added past
 * what the server had (Regenerate appends), and which version it chose to
 * show. Positions, not text, identify versions — identical texts stay distinct.
 */
const replayOnto = (server: ChatMessage, base: ChatMessage, local: ChatMessage): ChatMessage => {
    const baseCount = versionsOf(base).length;
    const added = versionsOf(local).slice(baseCount);
    const shownChanged = shownOf(local) !== shownOf(base);
    if (!added.length && !shownChanged) return server;
    const serverVersions = versionsOf(server);
    const versions = [...serverVersions, ...added];
    // A local index past the base lands past the server's own versions
    const remap = (i: number) => (i < baseCount ? i : serverVersions.length + (i - baseCount));
    const interruptedVersions = [
        ...(server.interruptedVersions ?? []),
        ...(local.interruptedVersions ?? []).filter(i => i >= baseCount).map(remap)
    ];
    const shown = shownChanged ? remap(shownOf(local)) : shownOf(server);
    return {
        ...server,
        content: versions[shown] ?? server.content,
        ...(versions.length > 1 && { versions, shownVersion: shown }),
        ...(interruptedVersions.length && { interruptedVersions })
    };
};

/**
 * The server's conversation with this device's unsaved changes replayed onto
 * it. The server's messages keep their order and content; a message only
 * this device added goes in after the one it followed here (or at the end if
 * that one is gone).
 */
export const mergeUnsaved = (server: ChatMessage[], { base, local }: UnsavedChat): ChatMessage[] => {
    const baseById = new Map(base.map(message => [message.id, message]));
    const merged = server.map(message => {
        const before = baseById.get(message.id);
        const mine = local.find(m => m.id === message.id);
        return before && mine ? replayOnto(message, before, mine) : message;
    });
    const placed = new Set(merged.map(message => message.id));
    local.forEach((message, i) => {
        // Already there, or one the server had and has since dropped: not this device's to restore
        if (placed.has(message.id) || baseById.has(message.id)) return;
        const after = local[i - 1]?.id;
        const at = after ? merged.findIndex(m => m.id === after) : -1;
        merged.splice(at === -1 ? merged.length : at + 1, 0, message);
        placed.add(message.id);
    });
    return merged;
};
