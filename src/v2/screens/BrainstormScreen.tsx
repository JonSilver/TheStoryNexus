import { useRef, useState } from "react";
import { ArrowLeft, Loader2, Plus, Send, Square, Trash2 } from "lucide-react";
import {
    useBrainstormByStoryQuery,
    useCreateBrainstormMutation,
    useDeleteBrainstormMutation,
    useUpdateBrainstormMutation
} from "@/features/brainstorm/hooks/useBrainstormQuery";
import type { AIChat, ChatMessage } from "@/types/story";
import { useActionGeneration } from "../ai/useActionGeneration";
import { useV2Store } from "../state/useV2Store";
import type { ScreenProps } from "../V2App";

const historyText = (messages: ChatMessage[]) =>
    messages.map(m => `${m.role === "user" ? "Writer" : "Assistant"}: ${m.content}`).join("\n\n");

const chatMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({
    id: crypto.randomUUID(),
    role,
    content,
    timestamp: new Date()
});

/**
 * Brainstorm on the v2 action pipeline: chat history and the new message go
 * up as chat_history/user_message; matched bible entries and story voice are
 * assembled server-side like every other action.
 */
export const BrainstormScreen = ({ goTo }: ScreenProps) => {
    const { currentStoryId } = useV2Store();
    const { data: chats } = useBrainstormByStoryQuery(currentStoryId ?? "");
    const createChat = useCreateBrainstormMutation();
    const updateChat = useUpdateBrainstormMutation();
    const deleteChat = useDeleteBrainstormMutation();
    const generation = useActionGeneration();
    const [chatId, setChatId] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const chat = (chats ?? []).find(c => c.id === chatId) ?? null;

    const send = async () => {
        if (!chat || !currentStoryId || !draft.trim() || generation.phase === "streaming") return;
        const userMessage = draft.trim();
        setDraft("");
        const withUser = [...chat.messages, chatMessage("user", userMessage)];
        // Sequential writes: firing the user-message update without awaiting
        // let it finish AFTER the reply update and clobber the assistant turn
        await updateChat.mutateAsync({ id: chat.id, data: { messages: withUser } }).catch(() => undefined);

        const reply = await generation.run({
            actionId: "brainstorm",
            storyId: currentStoryId,
            editorContext: { chatHistory: historyText(chat.messages), userMessage }
        });
        const finalReply = reply || generation.text;
        if (finalReply)
            await updateChat
                .mutateAsync({ id: chat.id, data: { messages: [...withUser, chatMessage("assistant", finalReply)] } })
                .catch(() => undefined);
        generation.reset();
        requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight }));
    };

    const newChat = () => {
        if (!currentStoryId) return;
        createChat.mutate(
            { id: crypto.randomUUID(), storyId: currentStoryId, title: `Chat ${(chats?.length ?? 0) + 1}`, messages: [] } as Omit<
                AIChat,
                "createdAt"
            >,
            { onSuccess: created => setChatId(created.id) }
        );
    };

    if (!currentStoryId)
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-muted-foreground">Pick a story first.</p>
                <button
                    type="button"
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                    onClick={() => goTo("stories")}
                >
                    Choose a story
                </button>
            </div>
        );

    if (!chat)
        return (
            <div className="flex h-full flex-col">
                <header className="flex items-center gap-2 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <button type="button" onClick={() => goTo("more")} aria-label="Back">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <h1 className="text-lg font-semibold">Brainstorm</h1>
                    <button type="button" onClick={newChat} aria-label="New chat" className="ml-auto">
                        <Plus className="h-5 w-5" />
                    </button>
                </header>
                <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
                    {(chats ?? []).map(c => (
                        <li key={c.id} className="flex items-center gap-2 px-4 py-3">
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setChatId(c.id)}>
                                <p className="font-medium">{c.title}</p>
                                <p className="line-clamp-1 text-sm text-muted-foreground">
                                    {c.messages[c.messages.length - 1]?.content ?? "Empty chat"}
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() => deleteChat.mutate(c.id)}
                                aria-label={`Delete ${c.title}`}
                                className="text-muted-foreground"
                            >
                                <Trash2 className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                    {(chats ?? []).length === 0 && (
                        <li className="p-8 text-center text-sm text-muted-foreground">No chats yet — start one.</li>
                    )}
                </ul>
            </div>
        );

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-center gap-2 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <button type="button" onClick={() => setChatId(null)} aria-label="Back to chats">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="truncate text-lg font-semibold">{chat.title}</h1>
            </header>
            <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {chat.messages.map(message => (
                    <div
                        key={message.id}
                        className={`max-w-[85%] whitespace-pre-wrap rounded-lg p-3 text-sm ${
                            message.role === "user" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"
                        }`}
                    >
                        {message.content}
                    </div>
                ))}
                {generation.phase === "streaming" && (
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                        {generation.text || <Loader2 className="h-4 w-4 animate-spin" />}
                    </div>
                )}
                {generation.error && <p className="text-sm text-destructive">{generation.error}</p>}
            </div>
            <footer className="flex gap-2 border-t p-3">
                <textarea
                    className="max-h-32 min-h-11 flex-1 resize-y rounded-md border bg-background px-3 py-2 text-sm"
                    placeholder="Bounce an idea around…"
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                        }
                    }}
                />
                {generation.phase === "streaming" ? (
                    <button type="button" onClick={generation.abort} aria-label="Stop" className="rounded-md border px-3">
                        <Square className="h-4 w-4" />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => void send()}
                        disabled={!draft.trim()}
                        aria-label="Send"
                        className="rounded-md bg-primary px-3 text-primary-foreground disabled:opacity-50"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                )}
            </footer>
        </div>
    );
};
