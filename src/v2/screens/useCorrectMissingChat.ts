import { attemptPromise } from "@jfdi/attempt";
import { useEffect } from "react";
import { toast } from "react-toastify";
import { pathFor, useNav } from "../routing";

/**
 * A link to a chat this story's list doesn't show: ask the server (a chat
 * created a moment ago may not be listed yet). Gone — say so and put the URL
 * right; another story's — open it there; unanswerable — say that too.
 */
export const useCorrectMissingChat = (chatId: string | null | undefined, unlisted: boolean, storyId: string | null) => {
    const { navigate } = useNav();
    useEffect(() => {
        if (!unlisted || !chatId) return;
        const cancelled = { value: false };
        void (async () => {
            const [error, response] = await attemptPromise(() =>
                fetch(`/api/brainstorm/${encodeURIComponent(chatId)}`)
            );
            if (cancelled.value) return;
            if (response?.status === 404) {
                toast.info("That chat no longer exists");
                navigate(pathFor("brainstorm", storyId), { replace: true });
                return;
            }
            const [decodeError, found] = await attemptPromise(async () => {
                if (error || !response?.ok) throw new Error("no answer");
                return (await response.json()) as { storyId?: string };
            });
            if (cancelled.value) return;
            if (decodeError || !found?.storyId) {
                toast.error(
                    "Couldn't check that chat — the server didn't answer properly. Showing this story's chats."
                );
                return;
            }
            if (found.storyId !== storyId)
                navigate(`${pathFor("brainstorm", found.storyId)}/${encodeURIComponent(chatId)}`, { replace: true });
        })();
        return () => {
            cancelled.value = true;
        };
    }, [unlisted, chatId, navigate, storyId]);
};
