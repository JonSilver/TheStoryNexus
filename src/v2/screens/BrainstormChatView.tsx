import { RotateCcw, Send, Square } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "react-toastify";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { ideaNote, useCreateNoteMutation } from "@/features/notes/hooks/useNotesQuery";
import type { AIChat, ChatMessage } from "@/types/story";
import { GenerationProgress } from "../ai/GenerationProgress";
import type { useActionGeneration } from "../ai/useActionGeneration";
import { ExtractSheet } from "../bible/ExtractSheet";
import { ScreenHeader } from "../components/ScreenParts";
import { useEvent } from "../hooks/useEvent";
import { ChatBubble, UnsavedBanner } from "./ChatBubble";
import { useChapterFromReply } from "./useChapterFromReply";
import type { useChatConversation } from "./useChatConversation";

/**
 * One open chat: the conversation, a reply as it streams, and where a reply
 * can go next (notes, the bible, a new chapter).
 */
export const BrainstormChatView = ({
    chat,
    storyId,
    conversation,
    generation,
    onBack
}: {
    chat: AIChat;
    storyId: string;
    conversation: ReturnType<typeof useChatConversation>;
    generation: ReturnType<typeof useActionGeneration>;
    onBack: () => void;
}) => {
    const createNote = useCreateNoteMutation();
    const { data: bibleEntries } = useHierarchicalLorebookQuery(storyId);
    const chapterFromMessage = useChapterFromReply(storyId);
    const [extracting, setExtracting] = useState<string | null>(null);
    const [draft, setDraft] = useState("");
    const scrollerRef = useRef<HTMLDivElement | null>(null);

    const { messages, unsaved } = conversation;
    const streamingHere = generation.phase === "streaming" && conversation.generatingFor === chat.id;
    const streamingElsewhere = generation.phase === "streaming" && !streamingHere;
    const idle = generation.phase !== "streaming";
    const unanswered = messages[messages.length - 1]?.role === "user";

    // Stable, so memoised bubbles skip re-rendering while a reply streams
    const saveNote = useEvent((message: ChatMessage) =>
        createNote.mutate(ideaNote(storyId, message.content), { onSuccess: () => toast.success("Saved to Notes") })
    );
    const toBible = useEvent((message: ChatMessage) => setExtracting(message.content));
    const toChapter = useEvent((message: ChatMessage) => chapterFromMessage(message.content));
    const regenerate = useEvent(() => void conversation.regenerate());
    const showVersion = useEvent((message: ChatMessage, index: number) => conversation.showVersion(message, index));

    const send = async () => {
        if (!draft.trim() || generation.phase === "streaming") return;
        const userMessage = draft.trim();
        setDraft("");
        // Unconfirmed: the message stays in the conversation, marked unsaved — not back in the draft,
        // which would send it twice if the save had in fact landed
        if (!(await conversation.send(userMessage))) return;
        requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight }));
    };

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title={chat.title} onBack={onBack} backLabel="Back to chats" />
            <div ref={scrollerRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                {messages.map(message => (
                    <ChatBubble
                        key={message.id}
                        message={message}
                        isLast={message.id === messages[messages.length - 1]?.id}
                        onSaveNote={saveNote}
                        onToBible={toBible}
                        onToChapter={toChapter}
                        onRegenerate={regenerate}
                        onShowVersion={showVersion}
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
                        deviceOnly={unsaved.deviceOnly}
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
            {extracting && (
                <ExtractSheet
                    mode="extract-paste"
                    storyId={storyId}
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
