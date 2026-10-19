import { useBrainstormByStoryQuery } from "@/features/brainstorm/hooks/useBrainstormQuery";
import { useActionGeneration } from "../ai/useActionGeneration";
import { NoStoryChosen } from "../components/ScreenParts";
import { useRouteParams } from "../routeParams";
import { pathFor, useNav } from "../routing";
import { uiState, useCurrentStoryId } from "../state/useV2Store";
import { BrainstormChatList } from "./BrainstormChatList";
import { BrainstormChatView } from "./BrainstormChatView";
import { useChatConversation } from "./useChatConversation";
import { useCorrectMissingChat } from "./useCorrectMissingChat";

/**
 * Brainstorm on the v2 action pipeline: chat history and the new message go
 * up as chat_history/user_message; matched bible entries and story voice are
 * assembled server-side like every other action. The generation and the
 * conversation live here, above the list and the open chat, so a reply still
 * being written for one chat is known while the writer looks at another.
 */
export const BrainstormScreen = () => {
    const { goTo, goBack, navigate } = useNav();
    const currentStoryId = useCurrentStoryId();
    const { data: chats } = useBrainstormByStoryQuery(currentStoryId ?? "");
    const generation = useActionGeneration();
    // The open chat lives in the URL: back/forward and refresh keep it
    const { chatId } = useRouteParams();
    const chat = (chats ?? []).find(c => c.id === chatId) ?? null;
    useCorrectMissingChat(chatId, Boolean(chatId && chats && !chat), currentStoryId);
    const conversation = useChatConversation(chat, currentStoryId, uiState.lastChapterFor, generation);

    if (!currentStoryId) return <NoStoryChosen onChoose={() => goTo("library")} />;
    if (!chat)
        return (
            <BrainstormChatList
                storyId={currentStoryId}
                chats={chats ?? []}
                onOpen={id => navigate(`${pathFor("brainstorm", currentStoryId)}/${encodeURIComponent(id)}`)}
                onBack={() => goBack("story")}
            />
        );
    return (
        <BrainstormChatView
            chat={chat}
            storyId={currentStoryId}
            conversation={conversation}
            generation={generation}
            onBack={() => goBack("brainstorm")}
        />
    );
};
