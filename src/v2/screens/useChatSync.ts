import { useQueryClient } from "@tanstack/react-query";
import { useRef, useSyncExternalStore } from "react";
import { toast } from "react-toastify";
import { applyChatToCaches } from "@/features/brainstorm/hooks/useBrainstormQuery";
import { brainstormApi } from "@/services/api/client";
import type { AIChat, ChatMessage } from "@/types/story";
import {
    type ChatOp,
    addPending,
    applyOps,
    claimPending,
    clearPending,
    discardUnsaved as dropUnsaved,
    pendingVersion,
    readPending,
    readUnsaved,
    removePending,
    storageRefused,
    subscribePending
} from "./chatOps";

type WriteResult = { outcome: "ok" | "conflict"; chat: AIChat | null } | { outcome: "failed" } | { outcome: "gone" };

const putMessages = async (chat: AIChat, messages: ChatMessage[]): Promise<WriteResult> => {
    const result = await brainstormApi.writeMessages(chat, messages);
    if (result.ok) return { outcome: "ok", chat: result.data };
    if (result.status === 404) return { outcome: "gone" };
    if (result.status === 409)
        return { outcome: "conflict", chat: (result.body as { current?: AIChat } | null)?.current ?? null };
    return { outcome: "failed" };
};

// A conflict means another device wrote first: re-apply onto theirs and try again, a few times
const MAX_ATTEMPTS = 3;

/**
 * A chat as this device should show it: the server's conversation with this
 * device's pending changes applied. Changes are written one at a time,
 * guarded by the chat's revision — two devices never erase each other's
 * turns — and wait on this device (Save again) until a save is confirmed.
 */
export const useChatSync = (chat: AIChat | null) => {
    const queryClient = useQueryClient();
    // The newest server copy seen, per chat — a write must build on it, not on a render's snapshot
    const newest = useRef(new Map<string, AIChat>());
    const know = (seen: AIChat) => {
        const known = newest.current.get(seen.id);
        if (!known || (known.revision ?? 0) <= (seen.revision ?? 0)) newest.current.set(seen.id, seen);
    };
    if (chat) know(chat);
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    // Re-renders when this device's pending changes change — here, or in another tab
    useSyncExternalStore(subscribePending, pendingVersion);
    const pendingOps = chat ? readPending(chat.id) : [];
    const messages = chat ? applyOps(chat.messages, pendingOps) : [];
    // Shown at once, but only "unsaved" once nobody is saving it
    const unsaved = chat && readUnsaved(chat.id).length ? { chatId: chat.id, deviceOnly: storageRefused() } : null;

    /**
     * Saves this device's pending changes plus `ops`, one write at a time.
     * The new changes are stored on the device before the save starts and
     * stay pending (Save again) until a save is confirmed — a failure can't
     * tell "not saved" from "saved but the answer was lost", so dropping or
     * re-sending would risk loss or duplicates.
     */
    const commit = (chatId: string, ops: ChatOp[]): Promise<boolean> => {
        addPending(chatId, ops);
        claimPending(chatId, ops, true);
        const run = queue.current.then(async () => {
            const all = readPending(chatId);
            claimPending(chatId, all, true);
            const attempt = async (server: AIChat | undefined, left: number): Promise<boolean> => {
                if (!server) return false;
                const result = await putMessages(server, applyOps(server.messages, all));
                if (result.outcome === "gone") {
                    // Deleted (here, elsewhere, or by a restore): there is nothing left to save these into
                    clearPending(chatId);
                    toast.info("That chat was deleted, so its unsaved changes were dropped.");
                    return false;
                }
                if (result.outcome === "failed") return false;
                if (result.chat) {
                    know(result.chat);
                    applyChatToCaches(queryClient, result.chat);
                }
                if (result.outcome === "ok") return true;
                return left > 1 ? attempt(newest.current.get(chatId), left - 1) : false;
            };
            const saved = await attempt(newest.current.get(chatId), MAX_ATTEMPTS);
            if (saved)
                removePending(
                    chatId,
                    all.map(change => change.id)
                );
            else claimPending(chatId, all, false);
            return saved;
        });
        queue.current = run.catch(() => undefined);
        return run;
    };

    /** Writes what this device still holds unsaved. */
    const saveAgain = () => (chat ? commit(chat.id, []) : Promise.resolve(false));

    /** The writer chooses the saved conversation over this device's unsaved changes. */
    const discardUnsaved = () => {
        if (!chat) return;
        dropUnsaved(chat.id);
    };

    return { messages, unsaved, commit, saveAgain, discardUnsaved };
};
