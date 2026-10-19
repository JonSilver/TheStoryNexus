import { useEffect } from "react";
import { toast } from "react-toastify";
import { useBrainstormChatQuery } from "@/features/brainstorm/hooks/useBrainstormQuery";
import { pathFor, useNav } from "../routing";

/**
 * A link to a chat this story's list doesn't show: ask the server (a chat
 * created a moment ago may not be listed yet). Gone — say so and put the URL
 * right; another story's — open it there; unanswerable — say that too.
 */
export const useCorrectMissingChat = (chatId: string | null | undefined, unlisted: boolean, storyId: string | null) => {
    const { navigate } = useNav();
    const { data: found, error } = useBrainstormChatQuery(chatId, unlisted);
    useEffect(() => {
        if (!unlisted || !chatId) return;
        if (error) {
            if ((error as { status?: number }).status === 404) {
                toast.info("That chat no longer exists");
                navigate(pathFor("brainstorm", storyId), { replace: true });
            } else toast.error("Couldn't check that chat — the server didn't answer. Showing this story's chats.");
            return;
        }
        if (found && found.storyId !== storyId)
            navigate(`${pathFor("brainstorm", found.storyId)}/${encodeURIComponent(chatId)}`, { replace: true });
    }, [unlisted, chatId, error, found, navigate, storyId]);
};
