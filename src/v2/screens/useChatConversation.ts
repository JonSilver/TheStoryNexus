import { useEffect, useRef, useState } from "react";
import type { AIChat, ChatMessage } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import type { RunResult, useActionGeneration } from "../ai/useActionGeneration";
import { flushChapterSave } from "../editor/useChapterSaver";
import { op } from "./chatOps";
import { useChatSync } from "./useChatSync";

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
 * new message go up as chat_history/user_message; every change is saved as a
 * ChatOp (useChatSync). Nothing the model writes is lost: a reply cut short
 * is kept and labelled, and regenerating keeps earlier versions.
 */
export const useChatConversation = (
    chat: AIChat | null,
    storyId: string | null,
    lastChapterFor: (storyId: string) => string | null | undefined,
    generation: ReturnType<typeof useActionGeneration>
) => {
    // A reply can finish after the screen has gone (it's still saved); only
    // the screen's own state must not be touched then
    const alive = useRef(true);
    useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);
    const { messages, unsaved, commit, saveAgain, discardUnsaved } = useChatSync(chat);

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
        await commit(chat.id, [op({ type: "append", message, after: question.id })]);
        if (alive.current) generation.reset();
    };

    /**
     * False when the writer's message couldn't be confirmed saved: it stays in
     * the conversation as unsaved (Save again, then Try again) and nothing is
     * sent to the model.
     */
    const send = async (text: string): Promise<boolean> => {
        if (!chat) return false;
        const question = chatMessage("user", text);
        const history = messages;
        if (!(await commit(chat.id, [op({ type: "append", message: question, after: null })]))) return false;
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
        const reply = replyFrom(await runBrainstorm(messages.slice(0, lastIndex - 1), priorUser.content));
        if (!reply) return;
        await commit(chat.id, [
            op({ type: "addVersion", messageId: last.id, text: reply.text, interrupted: reply.interrupted })
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
        void commit(chat.id, [
            op({
                type: "show",
                messageId: message.id,
                index,
                versionId: message.versionIds?.[index] ?? null,
                basedOn: message.shownBy ?? null
            })
        ]);
    };

    return {
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
