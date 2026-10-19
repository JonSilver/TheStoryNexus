import type { ChatMessage } from "@/types/story";
import { randomUUID } from "../../utils/crypto";

/**
 * Every change to a brainstorm conversation, as data with its own id. A write
 * applies them to the server's CURRENT conversation — on a conflict, to the
 * newer one — so one device never erases another's turns. Applying is
 * idempotent by id: a change the server already has (a write that landed but
 * whose answer was lost) is skipped, never doubled, while two changes that
 * happen to carry the same text stay two.
 */
export type ChatOp =
    | { id: string; type: "append"; message: ChatMessage; after: string | null }
    | { id: string; type: "addVersion"; messageId: string; text: string; interrupted: boolean }
    | { id: string; type: "show"; messageId: string; index: number };

type OpInput = ChatOp extends infer O ? (O extends ChatOp ? Omit<O, "id"> : never) : never;

export const op = (input: OpInput): ChatOp => ({ ...input, id: randomUUID() }) as ChatOp;

const versionsOf = (message: ChatMessage) => message.versions ?? [message.content];

const update = (messages: ChatMessage[], id: string, change: (message: ChatMessage) => ChatMessage) =>
    messages.map(message => (message.id === id ? change(message) : message));

const APPLY: { [K in ChatOp["type"]]: (messages: ChatMessage[], op: Extract<ChatOp, { type: K }>) => ChatMessage[] } = {
    // After the message it answers (a reply), or at the end; never twice
    append: (messages, { message, after }) => {
        if (messages.some(m => m.id === message.id)) return messages;
        const at = after ? messages.findIndex(m => m.id === after) : -1;
        const next = [...messages];
        next.splice(at === -1 ? next.length : at + 1, 0, message);
        return next;
    },
    // Regenerate: a new version, identified by the change's id
    addVersion: (messages, { id, messageId, text, interrupted }) =>
        update(messages, messageId, message => {
            const versions = versionsOf(message);
            const versionIds = message.versionIds ?? versions.map(() => null);
            if (versionIds.includes(id)) return message;
            const index = versions.length;
            return {
                ...message,
                content: text,
                versions: [...versions, text],
                versionIds: [...versionIds, id],
                shownVersion: index,
                ...(interrupted && { interruptedVersions: [...(message.interruptedVersions ?? []), index] })
            };
        }),
    // Versions are append-only, so an index means the same version on every device
    show: (messages, { messageId, index }) =>
        update(messages, messageId, message => {
            const chosen = versionsOf(message)[index];
            return chosen === undefined ? message : { ...message, content: chosen, shownVersion: index };
        })
};

export const applyOps = (messages: ChatMessage[], ops: ChatOp[]): ChatMessage[] =>
    ops.reduce(
        (current, change) => (APPLY[change.type] as (m: ChatMessage[], o: ChatOp) => ChatMessage[])(current, change),
        messages
    );

export const PENDING_PREFIX = "storynexus-unsaved-chat:";
const pendingInMemory = new Map<string, ChatOp[]>();

/** An earlier build stored message lists, not changes: recover what this device had added or changed. */
const fromLegacy = (stored: unknown): ChatOp[] => {
    const legacy = stored as { base?: ChatMessage[]; local?: ChatMessage[] } | ChatMessage[];
    const local = Array.isArray(legacy) ? legacy : (legacy.local ?? []);
    const base = new Map((Array.isArray(legacy) ? [] : (legacy.base ?? [])).map(m => [m.id, m]));
    return local.flatMap((message, i): ChatOp[] => {
        const before = base.get(message.id);
        if (!before) return [op({ type: "append", message, after: local[i - 1]?.id ?? null })];
        const known = versionsOf(before).length;
        const added = versionsOf(message)
            .slice(known)
            .map((text, n) =>
                op({
                    type: "addVersion",
                    messageId: message.id,
                    text,
                    interrupted: message.interruptedVersions?.includes(known + n) ?? false
                })
            );
        const shown = message.shownVersion;
        const chose = shown !== undefined && shown !== before.shownVersion && shown < known;
        return [...added, ...(chose ? [op({ type: "show", messageId: message.id, index: shown })] : [])];
    });
};

const write = (chatId: string, ops: ChatOp[]) => {
    if (ops.length) pendingInMemory.set(chatId, ops);
    else pendingInMemory.delete(chatId);
    try {
        if (ops.length) localStorage.setItem(PENDING_PREFIX + chatId, JSON.stringify({ ops }));
        else localStorage.removeItem(PENDING_PREFIX + chatId);
    } catch {
        // Storage unavailable or full: the in-memory copy still covers this session
    }
};

const read = (chatId: string): ChatOp[] => {
    try {
        const raw = localStorage.getItem(PENDING_PREFIX + chatId);
        if (raw) {
            const stored = JSON.parse(raw) as { ops?: ChatOp[] };
            if (Array.isArray(stored.ops)) return stored.ops;
            // Converted once and stored, so the changes keep stable ids from here on
            const converted = fromLegacy(stored);
            write(chatId, converted);
            return converted;
        }
    } catch {
        // Unreadable storage: fall back to this session's copy
    }
    return pendingInMemory.get(chatId) ?? [];
};

/**
 * Changes on this device not yet confirmed saved — written BEFORE their save
 * starts, removed once it's confirmed, so a reload or closed tab mid-save
 * loses nothing. Adds and removes are by id: other tabs' changes stay.
 */
export const readPending = read;
export const addPending = (chatId: string, ops: ChatOp[]) => {
    const known = new Set(read(chatId).map(change => change.id));
    write(chatId, [...read(chatId), ...ops.filter(change => !known.has(change.id))]);
};
export const removePending = (chatId: string, ids: string[]) => {
    const gone = new Set(ids);
    write(
        chatId,
        read(chatId).filter(change => !gone.has(change.id))
    );
};
export const clearPending = (chatId: string) => write(chatId, []);
