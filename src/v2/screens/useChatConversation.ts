import { attemptPromise } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { applyChatToCaches } from "@/features/brainstorm/hooks/useBrainstormQuery";
import { useChaptersByStoryQuery, useCreateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import type { AIChat, ChatMessage } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import type { RunResult, useActionGeneration } from "../ai/useActionGeneration";
import { flushChapterSave } from "../editor/useChapterSaver";
import { type ChatOp, applyOps, readPending, writePending } from "./chatOps";

const historyText = (messages: ChatMessage[]) =>
    messages.map(m => `${m.role === "user" ? "Writer" : "Assistant"}: ${m.content}`).join("\n\n");

const chatMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({
    id: randomUUID(),
    role,
    content,
    timestamp: new Date()
});

/** A reply that produced text is kept — cut short (a failure, Stop, or leaving mid-reply), it's kept and labelled incomplete. */
const replyFrom = (result: RunResult) =>
    result.text.trim() && result.outcome !== "superseded"
        ? { text: result.text, interrupted: result.outcome !== "complete" }
        : null;

type WriteResult = { outcome: "ok" | "conflict"; chat: AIChat | null } | { outcome: "failed" };

const putMessages = async (chat: AIChat, messages: ChatMessage[]): Promise<WriteResult> => {
    const [error, response] = await attemptPromise(() =>
        fetch(`/api/brainstorm/${chat.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages, expectedRevision: chat.revision ?? 0 })
        })
    );
    if (error || !response || (!response.ok && response.status !== 409)) return { outcome: "failed" };
    const [, body] = await attemptPromise(() => response.json());
    return response.ok
        ? { outcome: "ok", chat: body as AIChat }
        : { outcome: "conflict", chat: (body as { current?: AIChat } | null)?.current ?? null };
};

// A conflict means another device wrote first: re-apply onto theirs and try again, a few times
const MAX_ATTEMPTS = 3;

/**
 * One brainstorm conversation on the action pipeline: chat history and the
 * new message go up as chat_history/user_message. Every change is a ChatOp
 * applied to the server's current conversation, written one at a time and
 * guarded by the chat's revision — two devices never erase each other's
 * turns. Nothing the model writes is lost: a reply cut short is kept and
 * labelled, regenerating keeps earlier versions, and changes that can't be
 * saved wait on this device (Save again) instead of vanishing.
 */
export const useChatConversation = (
    chat: AIChat | null,
    storyId: string | null,
    lastChapterFor: (storyId: string) => string | null | undefined,
    generation: ReturnType<typeof useActionGeneration>
) => {
    const queryClient = useQueryClient();
    // A reply can finish after the screen has gone (it's still saved); only
    // the screen's own state must not be touched then
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    // The newest server copy seen, per chat — a write must build on it, not on a render's snapshot
    const newest = useRef(new Map<string, AIChat>());
    const know = (seen: AIChat) => {
        const known = newest.current.get(seen.id);
        if (!known || (known.revision ?? 0) <= (seen.revision ?? 0)) newest.current.set(seen.id, seen);
    };
    if (chat) know(chat);
    const queue = useRef<Promise<unknown>>(Promise.resolve());
    // Re-render after this device's pending changes change; storage is the truth
    const [, setPendingVersion] = useState(0);
    const pendingOps = chat ? readPending(chat.id) : [];
    const messages = chat ? applyOps(chat.messages, pendingOps) : [];
    const unsaved = chat && pendingOps.length ? { chatId: chat.id } : null;

    /**
     * Writes this device's pending changes plus `ops`, one write at a time.
     * `keep` — on failure, keep them pending (Save again); otherwise drop
     * them (the writer still has them, e.g. the draft message).
     */
    const commit = (chatId: string, ops: ChatOp[], keep = true): Promise<boolean> => {
        const run = queue.current.then(async () => {
            // Writes are queued, so nothing else changes this device's pending list meanwhile
            const before = readPending(chatId);
            const all = [...before, ...ops];
            const attempt = async (server: AIChat | undefined, left: number): Promise<boolean> => {
                if (!server) return false;
                const result = await putMessages(server, applyOps(server.messages, all));
                if (result.outcome === "failed") return false;
                if (result.chat) {
                    know(result.chat);
                    applyChatToCaches(queryClient, result.chat);
                }
                if (result.outcome === "ok") return true;
                return left > 1 ? attempt(newest.current.get(chatId), left - 1) : false;
            };
            const saved = await attempt(newest.current.get(chatId), MAX_ATTEMPTS);
            writePending(chatId, saved ? [] : keep ? all : before);
            if (alive.current) setPendingVersion(v => v + 1);
            return saved;
        });
        queue.current = run.catch(() => undefined);
        return run;
    };

    // The chat a reply is being written for — switching chats mid-reply must not show it in, or let Stop cut it from, another
    const [generatingFor, setGeneratingFor] = useState<string | null>(null);

    const runBrainstorm = async (history: ChatMessage[], userMessage: string): Promise<RunResult> => {
        if (!storyId || !chat) return { text: "", outcome: "superseded" };
        const chapterId = lastChapterFor(storyId) ?? undefined;
        if (alive.current) setGeneratingFor(chat.id);
        if (chapterId) await flushChapterSave(chapterId);
        const result = await generation.run({
            actionId: "brainstorm",
            storyId,
            // The chat has READ the story: summaries + current chapter go up
            ...(chapterId ? { chapterId } : {}),
            editorContext: { chatHistory: historyText(history), userMessage }
        });
        if (alive.current) setGeneratingFor(null);
        return result;
    };

    const answer = async (history: ChatMessage[], question: ChatMessage) => {
        if (!chat) return;
        const reply = replyFrom(await runBrainstorm(history, question.content));
        // Nothing arrived: the writer's message stays unanswered, with the error and Try again
        if (!reply) return;
        const message = {
            ...chatMessage("assistant", reply.text),
            ...(reply.interrupted && { interruptedVersions: [0] })
        };
        await commit(chat.id, [{ type: "append", message, after: question.id }]);
        if (alive.current) generation.reset();
    };

    /** False when the writer's own message couldn't be saved — nothing was sent to the model. */
    const send = async (text: string): Promise<boolean> => {
        if (!chat) return false;
        const question = chatMessage("user", text);
        const history = messages;
        if (!(await commit(chat.id, [{ type: "append", message: question, after: null }], false))) return false;
        await answer(history, question);
        return true;
    };

    /**
     * Re-roll the LAST assistant reply. Earlier versions are kept on the
     * message (flip with ‹ ›) — a worse re-roll never costs the better one.
     */
    const regenerate = async () => {
        if (!chat || generation.phase === "streaming") return;
        const last = messages[messages.length - 1];
        const lastIndex = messages.length - 1;
        const priorUser = [...messages].reverse().find(m => m.role === "user");
        if (!last || last.role !== "assistant" || !priorUser) return;
        const baseCount = (last.versions ?? [last.content]).length;
        const reply = replyFrom(await runBrainstorm(messages.slice(0, lastIndex - 1), priorUser.content));
        if (!reply) return;
        await commit(chat.id, [
            { type: "addVersion", messageId: last.id, text: reply.text, interrupted: reply.interrupted, baseCount }
        ]);
        if (alive.current) generation.reset();
    };

    /** The writer's message is saved but unanswered (a failure, or they left mid-reply): send it again. */
    const retryLast = async () => {
        if (!chat || generation.phase === "streaming") return;
        const last = messages[messages.length - 1];
        if (!last || last.role !== "user") return;
        await answer(messages.slice(0, -1), last);
    };

    const showVersion = (message: ChatMessage, index: number) => {
        if (!chat || message.versions?.[index] === undefined) return;
        void commit(chat.id, [{ type: "show", messageId: message.id, index }]);
    };

    /** Writes what this device still holds unsaved. */
    const saveAgain = () => (chat ? commit(chat.id, []) : Promise.resolve(false));

    /** The writer chooses the saved conversation over this device's unsaved changes. */
    const discardUnsaved = () => {
        if (!chat) return;
        writePending(chat.id, []);
        setPendingVersion(v => v + 1);
    };

    return {
        isMounted: () => alive.current,
        messages,
        unsaved,
        generatingFor,
        saveAgain,
        discardUnsaved,
        send,
        regenerate,
        retryLast,
        showVersion
    };
};

/** Brainstormed material flows onward: a new chapter carries the reply as its outline, ready to write against. */
export const useChapterFromReply = (storyId: string | null) => {
    const { data: storyChapters } = useChaptersByStoryQuery(storyId ?? "");
    const createChapter = useCreateChapterMutation();
    return (content: string) => {
        const title = window.prompt("Title for the new chapter", content.split("\n")[0].slice(0, 60))?.trim();
        if (!title || !storyId) return;
        createChapter.mutate(
            {
                id: randomUUID(),
                storyId,
                title,
                order: storyChapters?.length ?? 0,
                content: "",
                revision: 0,
                wordCount: 0,
                outline: { content, lastUpdated: new Date() }
            },
            { onSuccess: () => toast.success(`Chapter “${title}” created with this as its outline`) }
        );
    };
};
