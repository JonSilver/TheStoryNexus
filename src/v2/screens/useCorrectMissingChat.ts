import { attemptPromise } from "@jfdi/attempt";
import { useEffect } from "react";
import { toast } from "react-toastify";
import { pathFor, useNav } from "../routing";

/**
 * A link to a chat that no longer exists: say so, and put the URL right.
 * Asks the server rather than trusting the cached list — a chat created a
 * moment ago may not be in it yet.
 */
export const useCorrectMissingChat = (chatId: string | null | undefined, unlisted: boolean, storyId: string | null) => {
    const { navigate } = useNav();
    useEffect(() => {
        if (!unlisted || !chatId) return;
        const cancelled = { value: false };
        void (async () => {
            const [, response] = await attemptPromise(() => fetch(`/api/brainstorm/${encodeURIComponent(chatId)}`));
            if (cancelled.value || response?.status !== 404) return;
            toast.info("That chat no longer exists");
            navigate(pathFor("brainstorm", storyId), { replace: true });
        })();
        return () => {
            cancelled.value = true;
        };
    }, [unlisted, chatId, navigate, storyId]);
};
