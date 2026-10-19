import type { ChatMessage } from "@/types/story";

/**
 * Every change to a brainstorm conversation, as data. A write applies them
 * to the server's CURRENT conversation — on a conflict, to the newer one —
 * so one device never erases another's turns; ones that can't be saved yet
 * wait on this device and replay later. Applying is idempotent: a change the
 * server already has (a write that landed but whose answer was lost) is
 * skipped, never doubled.
 */
export type ChatOp =
    | { type: "append"; message: ChatMessage; after: string | null }
    | { type: "addVersion"; messageId: string; text: string; interrupted: boolean; baseCount: number }
    | { type: "show"; messageId: string; index: number };

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
    // Regenerate: a version past the ones it was made from; already there means it already landed
    addVersion: (messages, { messageId, text, interrupted, baseCount }) =>
        update(messages, messageId, message => {
            const versions = versionsOf(message);
            if (versions[baseCount] === text) return message;
            const index = versions.length;
            return {
                ...message,
                content: text,
                versions: [...versions, text],
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
        (current, op) => (APPLY[op.type] as (m: ChatMessage[], o: ChatOp) => ChatMessage[])(current, op),
        messages
    );

const PENDING_PREFIX = "storynexus-unsaved-chat:";
const pendingInMemory = new Map<string, ChatOp[]>();

// An earlier build stored whole message lists: what this device added becomes appends
const fromLegacy = (stored: unknown): ChatOp[] | null => {
    const legacy = stored as { base?: ChatMessage[]; local?: ChatMessage[] } | ChatMessage[];
    const local = Array.isArray(legacy) ? legacy : legacy.local;
    if (!Array.isArray(local)) return null;
    const base = new Set((Array.isArray(legacy) ? [] : (legacy.base ?? [])).map(m => m.id));
    return local.flatMap((message, i) =>
        base.has(message.id) ? [] : [{ type: "append" as const, message, after: local[i - 1]?.id ?? null }]
    );
};

/** Changes this device couldn't save yet — kept until they are, across leaving and reloading. */
export const readPending = (chatId: string): ChatOp[] => {
    try {
        const raw = localStorage.getItem(PENDING_PREFIX + chatId);
        if (raw) {
            const stored = JSON.parse(raw) as { ops?: ChatOp[] };
            return Array.isArray(stored.ops) ? stored.ops : (fromLegacy(stored) ?? []);
        }
    } catch {
        // Unreadable storage: fall back to this session's copy
    }
    return pendingInMemory.get(chatId) ?? [];
};

export const writePending = (chatId: string, ops: ChatOp[]) => {
    if (ops.length) pendingInMemory.set(chatId, ops);
    else pendingInMemory.delete(chatId);
    try {
        if (ops.length) localStorage.setItem(PENDING_PREFIX + chatId, JSON.stringify({ ops }));
        else localStorage.removeItem(PENDING_PREFIX + chatId);
    } catch {
        // Storage unavailable or full: the in-memory copy still covers this session
    }
};
