import type { ChatMessage } from "@/types/story";

// A conversation the server refused to save is kept in this browser until it
// is saved — leaving the screen or reloading must not lose a paid-for reply.
// Memory backs it up where storage is unavailable (private browsing).
const UNSAVED_PREFIX = "storynexus-unsaved-chat:";
const unsavedInMemory = new Map<string, ChatMessage[]>();

export const readUnsaved = (chatId: string): ChatMessage[] | null => {
    try {
        const raw = localStorage.getItem(UNSAVED_PREFIX + chatId);
        if (raw) return JSON.parse(raw) as ChatMessage[];
    } catch {
        // Unreadable storage: fall back to this session's copy
    }
    return unsavedInMemory.get(chatId) ?? null;
};

export const writeUnsaved = (chatId: string, messages: ChatMessage[] | null) => {
    if (messages) unsavedInMemory.set(chatId, messages);
    else unsavedInMemory.delete(chatId);
    try {
        if (messages) localStorage.setItem(UNSAVED_PREFIX + chatId, JSON.stringify(messages));
        else localStorage.removeItem(UNSAVED_PREFIX + chatId);
    } catch {
        // Storage unavailable or full: the in-memory copy still covers this session
    }
};

const versionsOf = (message: ChatMessage) => message.versions ?? [message.content];

/** Every version either copy has, none lost; this device's choice of shown version wins (the writer here chose it). */
const unionVersions = (server: ChatMessage, local: ChatMessage): ChatMessage => {
    const serverVersions = versionsOf(server);
    const localVersions = versionsOf(local);
    const extra = localVersions.filter(version => !serverVersions.includes(version));
    if (!extra.length) return server;
    const versions = [...serverVersions, ...extra];
    const interrupted = new Set([
        ...(server.interruptedVersions ?? []).map(i => serverVersions[i]),
        ...(local.interruptedVersions ?? []).map(i => localVersions[i])
    ]);
    const interruptedVersions = versions.flatMap((version, i) => (interrupted.has(version) ? [i] : []));
    return {
        ...server,
        content: local.content,
        versions,
        shownVersion: versions.indexOf(local.content),
        ...(interruptedVersions.length && { interruptedVersions })
    };
};

const when = (message: ChatMessage) => {
    const time = new Date(message.timestamp).getTime();
    return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
};

/**
 * The server's conversation plus what this device couldn't save — never
 * instead of it. Another device may have added to the chat since; its
 * messages stay. Messages are matched by id: one only this device has is
 * added in time order; one both have keeps every version either copy holds.
 */
export const mergeUnsaved = (server: ChatMessage[], local: ChatMessage[]): ChatMessage[] => {
    const localById = new Map(local.map(message => [message.id, message]));
    const serverIds = new Set(server.map(message => message.id));
    const shared = server.map(message => {
        const mine = localById.get(message.id);
        return mine ? unionVersions(message, mine) : message;
    });
    const localOnly = local.filter(message => !serverIds.has(message.id));
    if (!localOnly.length) return shared;
    // Stable: server order holds among its own messages; local ones slot in by when they were written
    return [...shared, ...localOnly]
        .map((message, order) => ({ message, order }))
        .sort((a, b) => when(a.message) - when(b.message) || a.order - b.order)
        .map(({ message }) => message);
};
