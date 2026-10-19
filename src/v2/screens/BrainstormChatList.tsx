import { Plus, Trash2 } from "lucide-react";
import {
    useCreateBrainstormMutation,
    useDeleteBrainstormMutation
} from "@/features/brainstorm/hooks/useBrainstormQuery";
import type { AIChat } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import { useConfirm } from "../components/Dialogs";
import { ScreenHeader } from "../components/ScreenParts";
import { clearPending } from "./chatOps";

/** A story's brainstorm chats: open one, start one, delete one. */
export const BrainstormChatList = ({
    storyId,
    chats,
    onOpen,
    onBack
}: {
    storyId: string;
    chats: AIChat[];
    onOpen: (chatId: string) => void;
    onBack: () => void;
}) => {
    const createChat = useCreateBrainstormMutation();
    const deleteChat = useDeleteBrainstormMutation();
    const confirm = useConfirm();

    const newChat = () =>
        createChat.mutate(
            { id: randomUUID(), storyId, title: `Chat ${chats.length + 1}`, messages: [] } as Omit<AIChat, "createdAt">,
            { onSuccess: created => onOpen(created.id) }
        );

    const remove = async (chat: AIChat) => {
        if (await confirm({ message: `Delete “${chat.title}” and its whole conversation?`, confirmLabel: "Delete" }))
            deleteChat.mutate(chat.id, { onSuccess: () => clearPending(chat.id) });
    };

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title="Brainstorm" onBack={onBack}>
                <button type="button" onClick={newChat} aria-label="New chat">
                    <Plus className="h-5 w-5" />
                </button>
            </ScreenHeader>
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
                {chats.map(chat => (
                    <li key={chat.id} className="flex items-center gap-2 px-4 py-3">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(chat.id)}>
                            <p className="font-medium">{chat.title}</p>
                            <p className="line-clamp-1 text-sm text-muted-foreground">
                                {chat.messages[chat.messages.length - 1]?.content ?? "Empty chat"}
                            </p>
                        </button>
                        <button
                            type="button"
                            onClick={() => void remove(chat)}
                            aria-label={`Delete ${chat.title}`}
                            className="text-muted-foreground"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </li>
                ))}
                {chats.length === 0 && (
                    <li className="p-8 text-center text-sm text-muted-foreground">No chats yet — start one.</li>
                )}
            </ul>
        </div>
    );
};
