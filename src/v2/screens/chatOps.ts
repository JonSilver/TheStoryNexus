import type { ChatMessage } from "@/types/story";
import { randomUUID } from "../../utils/crypto";

/**
 * Every change to a brainstorm conversation, as data with its own id. A write
 * applies them to the server's CURRENT conversation — on a conflict, to the
 * newer one — so one device never erases another's turns. Applying is
 * idempotent: a change the server already has (a write that landed but whose
 * answer was lost) is skipped, never doubled or replayed over a newer one.
 */
export type ChatOp =
    | { id: string; type: "append"; message: ChatMessage; after: string | null }
    | { id: string; type: "addVersion"; messageId: string; text: string; interrupted: boolean }
    // `basedOn`: the change that had set the shown version when this choice was made
    | { id: string; type: "show"; messageId: string; index: number; basedOn: string | null };

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
    // Regenerate: a new version, identified by the change's id; it becomes the one shown
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
                shownBy: id,
                ...(interrupted && { interruptedVersions: [...(message.interruptedVersions ?? []), index] })
            };
        }),
    // Only over the choice it replaced: if anyone (or this very change) has chosen since, theirs stands
    show: (messages, { id, messageId, index, basedOn }) =>
        update(messages, messageId, message => {
            const chosen = versionsOf(message)[index];
            if (chosen === undefined || (message.shownBy ?? null) !== basedOn) return message;
            return { ...message, content: chosen, shownVersion: index, shownBy: id };
        })
};

export const applyOps = (messages: ChatMessage[], ops: ChatOp[]): ChatMessage[] =>
    ops.reduce(
        (current, change) => (APPLY[change.type] as (m: ChatMessage[], o: ChatOp) => ChatMessage[])(current, change),
        messages
    );

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
        // After the additions the newest is shown; a different choice is replayed on top of them
        const showing = added.length ? versionsOf(message).length - 1 : (before.shownVersion ?? known - 1);
        const shown = message.shownVersion;
        if (shown === undefined || shown === showing) return added;
        const basedOn = added.length ? added[added.length - 1].id : (before.shownBy ?? null);
        return [...added, op({ type: "show", messageId: message.id, index: shown, basedOn })];
    });
};

/**
 * Changes on this device not yet confirmed saved, one storage key per change
 * — so tabs never overwrite each other's — written BEFORE their save starts
 * and removed once it's confirmed, so a reload or closed tab mid-save loses
 * nothing. A change being saved carries `savingUntil`: other tabs neither
 * call it unsaved nor discard it meanwhile. Memory holds what storage can't.
 */
export const PENDING_PREFIX = "storynexus-unsaved-chat:";
const SAVE_CLAIM_MS = 60_000;

interface Stored {
    op: ChatOp;
    /** Creation order — storage keys have none. */
    seq: number;
    savingUntil: number;
}

const inMemory = new Map<string, Stored>();
const keyFor = (chatId: string, opId: string) => `${PENDING_PREFIX}${chatId}:${opId}`;
const sequence = { last: 0 };
const nextSeq = () => {
    sequence.last = Math.max(sequence.last + 1, Date.now() * 1000);
    return sequence.last;
};

const storageKeys = (): string[] => {
    try {
        return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter(
            (key): key is string => !!key?.startsWith(PENDING_PREFIX)
        );
    } catch {
        return [];
    }
};

const store = (chatId: string, record: Stored) => {
    inMemory.set(keyFor(chatId, record.op.id), record);
    try {
        localStorage.setItem(keyFor(chatId, record.op.id), JSON.stringify(record));
    } catch {
        // Storage unavailable or full: the in-memory copy still covers this session
    }
};

const unstore = (key: string) => {
    inMemory.delete(key);
    try {
        localStorage.removeItem(key);
    } catch {
        // Unwritable storage: the in-memory removal still applies this session
    }
};

const migrateLegacy = (chatId: string) => {
    try {
        const raw = localStorage.getItem(PENDING_PREFIX + chatId);
        if (!raw) return;
        // Converted once into per-change keys, so the changes keep stable ids from here on
        fromLegacy(JSON.parse(raw)).forEach(change => store(chatId, { op: change, seq: nextSeq(), savingUntil: 0 }));
        localStorage.removeItem(PENDING_PREFIX + chatId);
    } catch {
        // An unreadable legacy record can't be recovered; it's left in place, harmlessly
    }
};

const records = (chatId: string): Array<{ key: string } & Stored> => {
    migrateLegacy(chatId);
    const prefix = `${PENDING_PREFIX}${chatId}:`;
    const found = new Map<string, Stored>();
    storageKeys()
        .filter(key => key.startsWith(prefix))
        .forEach(key => {
            try {
                found.set(key, JSON.parse(localStorage.getItem(key) ?? "") as Stored);
            } catch {
                // A corrupt entry is skipped rather than blocking the rest
            }
        });
    inMemory.forEach((record, key) => {
        if (key.startsWith(prefix) && !found.has(key)) found.set(key, record);
    });
    return [...found.entries()].map(([key, record]) => ({ key, ...record })).sort((a, b) => a.seq - b.seq);
};

export const readPending = (chatId: string): ChatOp[] => records(chatId).map(record => record.op);

/** Pending changes nobody is saving right now — what the writer should see as unsaved. */
export const readUnsaved = (chatId: string): ChatOp[] =>
    records(chatId)
        .filter(record => record.savingUntil < Date.now())
        .map(record => record.op);

export const addPending = (chatId: string, ops: ChatOp[]) =>
    ops.forEach(change => store(chatId, { op: change, seq: nextSeq(), savingUntil: 0 }));

/** Marks changes as being saved by this tab (or, with `saving` false, as waiting again). */
export const claimPending = (chatId: string, ops: ChatOp[], saving: boolean) =>
    records(chatId)
        .filter(record => ops.some(change => change.id === record.op.id))
        .forEach(record =>
            store(chatId, { op: record.op, seq: record.seq, savingUntil: saving ? Date.now() + SAVE_CLAIM_MS : 0 })
        );

export const removePending = (chatId: string, ids: string[]) => ids.forEach(id => unstore(keyFor(chatId, id)));

/** Drops what the writer sees as unsaved — never a change another tab is saving right now. */
export const discardUnsaved = (chatId: string) =>
    removePending(
        chatId,
        readUnsaved(chatId).map(change => change.id)
    );

export const clearPending = (chatId: string) =>
    removePending(
        chatId,
        readPending(chatId).map(change => change.id)
    );
