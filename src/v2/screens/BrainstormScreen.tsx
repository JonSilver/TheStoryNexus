import { ArrowLeft, Plus, RotateCcw, Send, Square, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import {
    useBrainstormByStoryQuery,
    useCreateBrainstormMutation,
    useDeleteBrainstormMutation
} from "@/features/brainstorm/hooks/useBrainstormQuery";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { useCreateNoteMutation } from "@/features/notes/hooks/useNotesQuery";
import type { AIChat } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import type { ScreenProps } from "../V2App";
import { GenerationProgress } from "../ai/GenerationProgress";
import { useActionGeneration } from "../ai/useActionGeneration";
import { ExtractSheet } from "../bible/ExtractSheet";
import { useRouteParams } from "../routeParams";
import { pathFor, useNav } from "../routing";
import { useV2Store } from "../state/useV2Store";
import { ChatBubble, UnsavedBanner } from "./ChatBubble";
import { clearPending } from "./chatOps";
import { useChapterFromReply, useChatConversation } from "./useChatConversation";
import { useCorrectMissingChat } from "./useCorrectMissingChat";

/**
 * Brainstorm on the v2 action pipeline: chat history and the new message go
 * up as chat_history/user_message; matched bible entries and story voice are
 * assembled server-side like every other action.
 */
export const BrainstormScreen = ({ goTo, goBack }: ScreenProps) => {
    const { currentStoryId, lastChapterFor } = useV2Store();
    const { data: chats } = useBrainstormByStoryQuery(currentStoryId ?? "");
    const createChat = useCreateBrainstormMutation();
    const deleteChat = useDeleteBrainstormMutation();
    const createNote = useCreateNoteMutation();
    const generation = useActionGeneration();
    // The open chat lives in the URL: back/forward and refresh keep it
    const { chatId } = useRouteParams();
    const { navigate } = useNav();
    const openChat = (id: string) => navigate(`${pathFor("brainstorm", currentStoryId)}/${encodeURIComponent(id)}`);
    const [extracting, setExtracting] = useState<string | null>(null);
    const { data: bibleEntries } = useHierarchicalLorebookQuery(currentStoryId ?? undefined);

    const chapterFromMessage = useChapterFromReply(currentStoryId);
    const [draft, setDraft] = useState("");
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const chat = (chats ?? []).find(c => c.id === chatId) ?? null;
    useCorrectMissingChat(chatId, Boolean(chatId && chats && !chat), currentStoryId);

    const conversation = useChatConversation(chat, currentStoryId, lastChapterFor, generation);
    const { messages, unsaved } = conversation;
    const streamingHere = generation.phase === "streaming" && conversation.generatingFor === chat?.id;
    const streamingElsewhere = generation.phase === "streaming" && !streamingHere;
    const idle = generation.phase !== "streaming";
    const unanswered = messages[messages.length - 1]?.role === "user";

    const send = async () => {
        if (!chat || !currentStoryId || !draft.trim() || generation.phase === "streaming") return;
        const userMessage = draft.trim();
        setDraft("");
        if (!(await conversation.send(userMessage))) {
            if (!conversation.isMounted()) return;
            setDraft(userMessage); // give the message back rather than losing it
            toast.error("Couldn't save your message — try again");
            return;
        }
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
            { onSuccess: created => openChat(created.id) }
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
                            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openChat(c.id)}>
                                <p className="font-medium">{c.title}</p>
                                <p className="line-clamp-1 text-sm text-muted-foreground">
                                    {c.messages[c.messages.length - 1]?.content ?? "Empty chat"}
                                </p>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    window.confirm(`Delete “${c.title}” and its whole conversation?`) &&
                                    deleteChat.mutate(c.id, { onSuccess: () => clearPending(c.id) })
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
                <button type="button" onClick={() => goBack("brainstorm")} aria-label="Back to chats">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="truncate text-lg font-semibold">{chat.title}</h1>
            </header>
            <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map(message => (
                    <ChatBubble
                        key={message.id}
                        message={message}
                        isLast={message.id === messages[messages.length - 1]?.id}
                        onSaveNote={() =>
                            createNote.mutate({
                                storyId: currentStoryId,
                                title: message.content.slice(0, 60),
                                content: message.content,
                                type: "idea"
                            })
                        }
                        onToBible={() => setExtracting(message.content)}
                        onToChapter={() => chapterFromMessage(message.content)}
                        onRegenerate={() => void conversation.regenerate()}
                        onShowVersion={index => conversation.showVersion(message, index)}
                    />
                ))}
                {streamingElsewhere && (
                    <p className="text-sm text-muted-foreground" role="status">
                        A reply is still being written in another chat — you can send here once it's done.
                    </p>
                )}
                {streamingHere && (
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-lg bg-muted p-3 text-sm">
                        {generation.text}
                        <GenerationProgress status={generation.status} className={generation.text ? "mt-2" : ""} />
                    </div>
                )}
                {unsaved?.chatId === chat.id && (
                    <UnsavedBanner
                        onSave={() => void conversation.saveAgain()}
                        onDiscard={conversation.discardUnsaved}
                    />
                )}
                {idle && generation.error && !unanswered && (
                    <p className="text-sm text-destructive" role="alert">
                        {generation.error} The earlier reply is still here.
                    </p>
                )}
                {!streamingHere && unanswered && (
                    <div className="space-y-2 text-sm" role="alert">
                        <p className={generation.error ? "text-destructive" : "text-muted-foreground"}>
                            {generation.error ?? "This message hasn't been answered."}
                        </p>
                        <button
                            type="button"
                            onClick={() => void conversation.retryLast()}
                            disabled={streamingElsewhere}
                            className="flex items-center gap-1 rounded-md border px-3 py-1"
                        >
                            <RotateCcw className="h-3.5 w-3.5" /> Try again
                        </button>
                    </div>
                )}
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
                {streamingHere ? (
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
                        disabled={!draft.trim() || streamingElsewhere}
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
