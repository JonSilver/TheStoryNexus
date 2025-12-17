import { useHotkeys } from "react-hotkeys-hook";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";

interface UseWorkspaceShortcutsProps {
    onOpenCommandPalette: () => void;
}

export const useWorkspaceShortcuts = ({ onOpenCommandPalette }: UseWorkspaceShortcutsProps) => {
    const { currentStoryId, currentChapterId, setCurrentTool, setCurrentChapterId } = useStoryContext();
    const { data: chapters = [] } = useChaptersByStoryQuery(currentStoryId || "");

    // Command Palette: Cmd/Ctrl+K
    useHotkeys(
        "mod+k",
        e => {
            e.preventDefault();
            onOpenCommandPalette();
        },
        [onOpenCommandPalette]
    );

    // Tool Navigation: Cmd/Ctrl+1-7
    useHotkeys(
        "mod+1",
        e => {
            e.preventDefault();
            setCurrentTool("stories");
        },
        [setCurrentTool]
    );

    useHotkeys(
        "mod+2",
        e => {
            e.preventDefault();
            if (currentStoryId) setCurrentTool("editor");
        },
        [currentStoryId, setCurrentTool]
    );

    useHotkeys(
        "mod+3",
        e => {
            e.preventDefault();
            if (currentStoryId) setCurrentTool("chapters");
        },
        [currentStoryId, setCurrentTool]
    );

    useHotkeys(
        "mod+4",
        e => {
            e.preventDefault();
            if (currentStoryId) setCurrentTool("lorebook");
        },
        [currentStoryId, setCurrentTool]
    );

    useHotkeys(
        "mod+5",
        e => {
            e.preventDefault();
            if (currentStoryId) setCurrentTool("brainstorm");
        },
        [currentStoryId, setCurrentTool]
    );

    useHotkeys(
        "mod+6",
        e => {
            e.preventDefault();
            setCurrentTool("prompts");
        },
        [setCurrentTool]
    );

    useHotkeys(
        "mod+7",
        e => {
            e.preventDefault();
            if (currentStoryId) setCurrentTool("notes");
        },
        [currentStoryId, setCurrentTool]
    );

    // Chapter Navigation: Cmd/Ctrl+]  for next chapter
    useHotkeys(
        "mod+]",
        e => {
            e.preventDefault();
            if (!currentChapterId || chapters.length === 0) return;

            const currentIndex = chapters.findIndex(c => c.id === currentChapterId);
            if (currentIndex < chapters.length - 1) {
                setCurrentChapterId(chapters[currentIndex + 1].id);
                setCurrentTool("editor");
            }
        },
        [currentChapterId, chapters, setCurrentChapterId, setCurrentTool]
    );

    // Chapter Navigation: Cmd/Ctrl+[ for previous chapter
    useHotkeys(
        "mod+[",
        e => {
            e.preventDefault();
            if (!currentChapterId || chapters.length === 0) return;

            const currentIndex = chapters.findIndex(c => c.id === currentChapterId);
            if (currentIndex > 0) {
                setCurrentChapterId(chapters[currentIndex - 1].id);
                setCurrentTool("editor");
            }
        },
        [currentChapterId, chapters, setCurrentChapterId, setCurrentTool]
    );
};
