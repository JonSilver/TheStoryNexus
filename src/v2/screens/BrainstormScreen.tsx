import { attemptPromise } from "@jfdi/attempt";
import { ArrowLeft, BookOpenText, FilePlus2, NotebookPen, Plus, RefreshCw, Send, Square, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import {
    useBrainstormByStoryQuery,
    useCreateBrainstormMutation,
    useDeleteBrainstormMutation,
    useUpdateBrainstormMutation
} from "@/features/brainstorm/hooks/useBrainstormQuery";
import { useChaptersByStoryQuery, useCreateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { useCreateNoteMutation } from "@/features/notes/hooks/useNotesQuery";
import type { AIChat, ChatMessage } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import type { ScreenProps } from "../V2App";
import { GenerationProgress } from "../ai/GenerationProgress";
import { useActionGeneration } from "../ai/useActionGeneration";
import { ExtractSheet } from "../bible/ExtractSheet";
import { MarkdownView } from "../components/MarkdownView";
import { flushChapterSave } from "../editor/useChapterSaver";
import { useRouteParams } from "../routeParams";
import { pathFor, useNav } from "../routing";
import { useV2Store } from "../state/useV2Store";

const historyText = (messages: ChatMessage[]) =>
    messages.map(m => `${m.role === "user" ? "Writer" : "Assistant"}: ${m.content}`).join("\n\n");

const chatMessage = (role: ChatMessage["role"], content: string): ChatMessage => ({
    id: randomUUID(),
    role,
    content,
    timestamp: new Date()
});

/**
 * Brainstorm on the v2 action pipeline: chat history and the new message go
 * up as chat_history/user_message; matched bible entries and story voice are
 * assembled server-side like every other action.
 */
export const BrainstormScreen = ({ goTo, goBack }: ScreenProps) => {
    const { currentStoryId, lastChapterFor } = useV2Store();
    const { data: chats } = useBrainstormByStoryQuery(currentStoryId ?? "");
    const createChat = useCreateBrainstormMutation();
    const updateChat = useUpdateBrainstormMutation();
    const deleteChat = useDeleteBrainstormMutation();
    const createNote = useCreateNoteMutation();
    const generation = useActionGeneration();
    // The open chat lives in the URL: back/forward and refresh keep it
    const { chatId } = useRouteParams();
    const { navigate } = useNav();
    const setChatId = (id: string | null) => {
        const list = pathFor("brainstorm", currentStoryId);
        navigate(id ? `${list}/${encodeURIComponent(id)}` : list);
    };
    const [extracting, setExtracting] = useState<string | null>(null);
    const { data: bibleEntries } = useHierarchicalLorebookQuery(currentStoryId ?? undefined);
    const { data: storyChapters } = useChaptersByStoryQuery(currentStoryId ?? "");
    const createChapter = useCreateChapterMutation();

    // Brainstormed material flows onward: a new chapter carries the reply as
    // its outline, ready to write against
    const chapterFromMessage = (content: string) => {
        const title = window.prompt("Title for the new chapter", content.split("\n")[0].slice(0, 60))?.trim();
        if (!title || !currentStoryId) return;
        createChapter.mutate(
            {
                id: randomUUID(),
                storyId: currentStoryId,
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
    const [draft, setDraft] = useState("");
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const chat = (chats ?? []).find(c => c.id === chatId) ?? null;

    const runBrainstorm = async (history: AIChat["messages"], userMessage: string): Promise<string> => {
        if (!currentStoryId) return "";
        const chapterId = lastChapterFor(currentStoryId) ?? undefined;
        if (chapterId) await flushChapterSave(chapterId);
        return generation.run({
            actionId: "brainstorm",
            storyId: currentStoryId,
            // The chat has READ the story: summaries + current chapter go up
            ...(chapterId ? { chapterId } : {}),
            editorContext: { chatHistory: historyText(history), userMessage }
        });
    };

    /** Re-roll the LAST assistant reply from the same user message. */
    const regenerate = async () => {
        if (!chat || generation.phase === "streaming") return;
        const messages = chat.messages;
        const last = messages[messages.length - 1];
        const priorUser = [...messages].reverse().find(m => m.role === "user");
        if (!last || last.role !== "assistant" || !priorUser) return;
        const kept = messages.slice(0, -1);
        const reply = await runBrainstorm(kept.slice(0, -1), priorUser.content);
        const finalReply = reply || generation.text;
        if (finalReply) {
            const [writeError] = await attemptPromise(() =>
                updateChat.mutateAsync({
                    id: chat.id,
                    data: { messages: [...kept, chatMessage("assistant", finalReply)] }
                })
            );
            if (writeError) toast.error("The reply couldn't be saved — it may vanish on refresh");
            generation.reset();
        }
    };

    const send = async () => {
        if (!chat || !currentStoryId || !draft.trim() || generation.phase === "streaming") return;
        const userMessage = draft.trim();
        setDraft("");
        const withUser = [...chat.messages, chatMessage("user", userMessage)];
        // Sequential writes: firing the user-message update without awaiting
        // let it finish AFTER the reply update and clobber the assistant turn
        const [userWriteError] = await attemptPromise(() =>
            updateChat.mutateAsync({ id: chat.id, data: { messages: withUser } })
        );
        if (userWriteError) {
            setDraft(userMessage); // give the message back rather than losing it
            toast.error("Couldn't save your message — try again");
            return;
        }

        const reply = await runBrainstorm(chat.messages, userMessage);
        const finalReply = reply || generation.text;
        if (finalReply) {
            const [replyWriteError] = await attemptPromise(() =>
                updateChat.mutateAsync({
                    id: chat.id,
                    data: { messages: [...withUser, chatMessage("assistant", finalReply)] }
                })
            );
            if (replyWriteError) toast.error("The reply couldn't be saved — it may vanish on refresh");
            generation.reset();
        }
        // Failure path deliberately does NOT reset: the inline error must
        // survive to be seen, or the AI just looks like it ignored the writer
        requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight }));
    };

    const newChat = () => {
        if (!currentStoryId) return;
        createChat.mutate(
            {
                id: randomUUID(),
                storyId: currentStoryId,
                title: `Chat ${(chats?.length ?? 0) + 1}`,
                messages: []
            } as Omit<AIChat, "createdAt">,
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
                    onClick={() => goTo("library")}
                >
                    Choose a story
                </button>
            </div>
        );

    if (!chat)
        return (
            <div className="flex h-full flex-col">
                <header className="flex items-center gap-2 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                    <button type="button" onClick={() => goBack("story")} aria-label="Back">
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
                                onClick={() =>
                                    window.confirm(`Delete “${c.title}” and its whole conversation?`) &&
                                    deleteChat.mutate(c.id)
                                }
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
                        className={`max-w-[85%] rounded-lg p-3 text-sm ${
                            message.role === "user"
                                ? "ml-auto whitespace-pre-wrap bg-primary text-primary-foreground"
                                : "bg-muted"
                        }`}
                    >
                        {message.role === "assistant" ? (
                            <MarkdownView>{message.content}</MarkdownView>
                        ) : (
                            message.content
                        )}
                        {message.role === "assistant" && (
                            <button
                                type="button"
                                onClick={() =>
                                    createNote.mutate({
                                        storyId: currentStoryId,
                                        title: message.content.slice(0, 60),
                                        content: message.content,
                                        type: "idea"
                                    })
                                }
                                aria-label="Save as note"
                                title="Save as note"
                                className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
                            >
                                <NotebookPen className="h-3.5 w-3.5" /> Save as note
                            </button>
                        )}
                        {message.role === "assistant" && (
                            <span className="flex flex-wrap gap-3">
                                <button
                                    type="button"
                                    onClick={() => setExtracting(message.content)}
                                    aria-label="Extract bible entries from this"
                                    className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
                                >
                                    <BookOpenText className="h-3.5 w-3.5" /> To bible
                                </button>
                                <button
                                    type="button"
                                    onClick={() => chapterFromMessage(message.content)}
                                    aria-label="New chapter from this"
                                    className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
                                >
                                    <FilePlus2 className="h-3.5 w-3.5" /> To chapter
                                </button>
                            </span>
                        )}
                        {message.role === "assistant" && message.id === chat.messages[chat.messages.length - 1]?.id && (
                            <button
                                type="button"
                                onClick={() => void regenerate()}
                                aria-label="Regenerate reply"
                                className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
                            >
                                <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                            </button>
                        )}
                    </div>
                ))}
                {generation.phase === "streaming" && (
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                        {generation.text || <GenerationProgress status={generation.status} />}
                    </div>
                )}
                {generation.error && <p className="text-sm text-destructive">{generation.error}</p>}
            </div>
            {extracting && currentStoryId && (
                <ExtractSheet
                    mode="extract-paste"
                    storyId={currentStoryId}
                    chapterId={null}
                    entries={bibleEntries ?? []}
                    initialText={extracting}
                    onClose={() => setExtracting(null)}
                />
            )}
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
                    <button
                        type="button"
                        onClick={generation.abort}
                        aria-label="Stop"
                        className="rounded-md border px-3"
                    >
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
