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

const versionCount = (message: ChatMessage) => message.versions?.length ?? 1;

/**
 * The server's conversation plus what this device couldn't save — never
 * instead of it. Another device may have added to the chat since; its
 * messages stay. Messages are matched by id: one only this device has is
 * appended; one both have keeps the server's copy unless this device's
 * carries more versions (a regenerate that never reached the server).
 */
export const mergeUnsaved = (server: ChatMessage[], local: ChatMessage[]): ChatMessage[] => {
    const localById = new Map(local.map(message => [message.id, message]));
    const serverIds = new Set(server.map(message => message.id));
    const merged = server.map(message => {
        const mine = localById.get(message.id);
        return mine && versionCount(mine) > versionCount(message) ? mine : message;
    });
    return [...merged, ...local.filter(message => !serverIds.has(message.id))];
};
