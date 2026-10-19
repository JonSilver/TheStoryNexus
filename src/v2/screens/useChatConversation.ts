import { attemptPromise } from "@jfdi/attempt";
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { useUpdateBrainstormMutation } from "@/features/brainstorm/hooks/useBrainstormQuery";
import { useChaptersByStoryQuery, useCreateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import type { AIChat, ChatMessage } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import type { RunResult, useActionGeneration } from "../ai/useActionGeneration";
import { flushChapterSave } from "../editor/useChapterSaver";
import { mergeUnsaved, readUnsaved, writeUnsaved } from "./unsavedChat";

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

/**
 * One brainstorm conversation on the action pipeline: chat history and the
 * new message go up as chat_history/user_message. Nothing the model writes
 * is lost — a reply cut short is kept and labelled, regenerating keeps
 * earlier versions, and a write that fails keeps its messages on screen
 * (with Save again) instead of letting them vanish.
 */
export const useChatConversation = (
    chat: AIChat | null,
    storyId: string | null,
    lastChapterFor: (storyId: string) => string | null | undefined,
    generation: ReturnType<typeof useActionGeneration>
) => {
    const updateChat = useUpdateBrainstormMutation();
    // A reply can finish after the screen has gone (it's still saved); only
    // the screen's own state must not be touched then
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    // Re-render after the browser-stored copy changes; the copy itself is the truth
    const [, setStoredVersion] = useState(0);
    // Kept with what the server had at the time, so only this device's changes are ever replayed
    const remember = (chatId: string, next: ChatMessage[] | null) => {
        writeUnsaved(chatId, next ? { base: chat?.messages ?? [], local: next } : null);
        if (alive.current) setStoredVersion(v => v + 1);
    };
    const serverMessages = chat?.messages ?? [];
    const stored = chat ? readUnsaved(chat.id) : null;
    const merged = stored ? mergeUnsaved(serverMessages, stored) : null;
    // Unsaved only while it holds something the server doesn't
    const pending = merged && JSON.stringify(merged) !== JSON.stringify(serverMessages) ? merged : null;
    const unsaved = chat && pending ? { chatId: chat.id, messages: pending } : null;
    const messages = pending ?? serverMessages;

    // The chat a reply is being written for — switching chats mid-reply must not show it in, or let Stop cut it from, another
    const [generatingFor, setGeneratingFor] = useState<string | null>(null);

    const runBrainstorm = async (history: ChatMessage[], userMessage: string): Promise<RunResult> => {
        if (!storyId || !chat) return { text: "", outcome: "superseded" };
        if (alive.current) setGeneratingFor(chat.id);
        const result = await runFor(history, userMessage);
        if (alive.current) setGeneratingFor(null);
        return result;
    };

    const runFor = async (history: ChatMessage[], userMessage: string): Promise<RunResult> => {
        if (!storyId) return { text: "", outcome: "superseded" };
        const chapterId = lastChapterFor(storyId) ?? undefined;
        if (chapterId) await flushChapterSave(chapterId);
        return generation.run({
            actionId: "brainstorm",
            storyId,
            // The chat has READ the story: summaries + current chapter go up
            ...(chapterId ? { chapterId } : {}),
            editorContext: { chatHistory: historyText(history), userMessage }
        });
    };

    const saveMessages = async (next: ChatMessage[]): Promise<boolean> => {
        if (!chat) return false;
        const [writeError] = await attemptPromise(() =>
            updateChat.mutateAsync({ id: chat.id, data: { messages: next } })
        );
        if (writeError) {
            remember(chat.id, next);
            return false;
        }
        remember(chat.id, null);
        return true;
    };

    const answer = async (history: ChatMessage[], userMessage: string, withUser: ChatMessage[]) => {
        const reply = replyFrom(await runBrainstorm(history, userMessage));
        // Nothing arrived: the writer's message stays unanswered, with the error and Try again
        if (!reply) return;
        await saveMessages([
            ...withUser,
            { ...chatMessage("assistant", reply.text), ...(reply.interrupted && { interruptedVersions: [0] }) }
        ]);
        if (alive.current) generation.reset();
    };

    /** False when the writer's own message couldn't be saved — nothing was sent. */
    const send = async (userMessage: string): Promise<boolean> => {
        if (!chat) return false;
        const withUser = [...messages, chatMessage("user", userMessage)];
        // Sequential writes: firing the user-message update without awaiting
        // let it finish AFTER the reply update and clobber the assistant turn
        const [userWriteError] = await attemptPromise(() =>
            updateChat.mutateAsync({ id: chat.id, data: { messages: withUser } })
        );
        if (userWriteError) return false;
        // That write carried everything on screen, unsaved messages included — they're saved now
        remember(chat.id, null);
        await answer(messages, userMessage, withUser);
        return true;
    };

    /**
     * Re-roll the LAST assistant reply. Earlier versions are kept on the
     * message (flip with ‹ ›) — a worse re-roll never costs the better one.
     */
    const regenerate = async () => {
        if (!chat || generation.phase === "streaming") return;
        const last = messages[messages.length - 1];
        const priorUser = [...messages].reverse().find(m => m.role === "user");
        if (!last || last.role !== "assistant" || !priorUser) return;
        const kept = messages.slice(0, -1);
        const reply = replyFrom(await runBrainstorm(kept.slice(0, -1), priorUser.content));
        if (!reply) return;
        const versions = [...(last.versions ?? [last.content]), reply.text];
        const interruptedVersions = [
            ...(last.interruptedVersions ?? []),
            ...(reply.interrupted ? [versions.length - 1] : [])
        ];
        await saveMessages([
            ...kept,
            {
                ...last,
                content: reply.text,
                versions,
                shownVersion: versions.length - 1,
                ...(interruptedVersions.length && { interruptedVersions })
            }
        ]);
        if (alive.current) generation.reset();
    };

    /** The writer's message is saved but unanswered (a failure, or they left mid-reply): send it again. */
    const retryLast = async () => {
        if (!chat || generation.phase === "streaming") return;
        const last = messages[messages.length - 1];
        if (!last || last.role !== "user") return;
        await answer(messages.slice(0, -1), last.content, messages);
    };

    const showVersion = (message: ChatMessage, index: number) => {
        const chosen = message.versions?.[index];
        if (!chat || chosen === undefined) return;
        void saveMessages(
            messages.map(m => (m.id === message.id ? { ...m, content: chosen, shownVersion: index } : m))
        );
    };

    /** The writer chooses the saved version over the unsaved one. */
    const discardUnsaved = () => {
        if (chat) remember(chat.id, null);
    };

    return {
        isMounted: () => alive.current,
        messages,
        unsaved,
        generatingFor,
        saveMessages,
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
