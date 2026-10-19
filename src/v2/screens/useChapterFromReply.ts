import { toast } from "react-toastify";
import { useCreateChapter } from "@/features/chapters/hooks/useChaptersQuery";
import { usePrompt } from "../components/Dialogs";

/** Brainstormed material flows onward: a new chapter carries the reply as its outline, ready to write against. */
export const useChapterFromReply = (storyId: string | null) => {
    const createChapter = useCreateChapter();
    const prompt = usePrompt();
    return async (content: string) => {
        const title = await prompt({
            title: "New chapter from this reply",
            label: "Chapter title",
            initial: content.split("\n")[0].slice(0, 60),
            confirmLabel: "Create"
        });
        if (!title || !storyId) return;
        createChapter.mutate(
            { storyId, title, outline: content },
            { onSuccess: () => toast.success(`Chapter “${title}” created with this as its outline`) }
        );
    };
};
