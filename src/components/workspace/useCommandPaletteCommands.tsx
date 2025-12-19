import { BookOpen, FileCode, FileText, HelpCircle, MessageSquare, StickyNote, Tags } from "lucide-react";
import { useMemo } from "react";
import type { Chapter, LorebookEntry, Note, Prompt, Story } from "@/types/story";
import type { WorkspaceTool } from "@/features/stories/context/StoryContext";

interface CommandItem {
    id: string;
    label: string;
    category: string;
    keywords: string[];
    icon: React.ReactNode;
    action: () => void;
    disabled?: boolean;
}

interface UseCommandsParams {
    currentStoryId: string | null;
    stories: Story[];
    chapters: Chapter[];
    lorebookEntries: LorebookEntry[];
    prompts: Prompt[];
    notes: Note[];
    setCurrentStoryId: (id: string) => void;
    setCurrentChapterId: (id: string) => void;
    setCurrentTool: (tool: WorkspaceTool) => void;
    onClose: () => void;
    navigate: (path: string) => void;
}

export const useCommandPaletteCommands = ({
    currentStoryId,
    stories,
    chapters,
    lorebookEntries,
    prompts,
    notes,
    setCurrentStoryId,
    setCurrentChapterId,
    setCurrentTool,
    onClose,
    navigate
}: UseCommandsParams): Map<string, CommandItem[]> => {
    const toolCommands = useMemo(
        () => [
            {
                id: "tool-stories",
                label: "Go to Stories",
                category: "Tools",
                keywords: ["stories", "tool", "navigate"],
                icon: <BookOpen className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentTool("stories");
                    onClose();
                }
            },
            {
                id: "tool-editor",
                label: "Go to Editor",
                category: "Tools",
                keywords: ["editor", "write", "tool", "navigate"],
                icon: <FileText className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentTool("editor");
                    onClose();
                },
                disabled: !currentStoryId
            },
            {
                id: "tool-chapters",
                label: "Go to Chapters",
                category: "Tools",
                keywords: ["chapters", "tool", "navigate"],
                icon: <FileText className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentTool("chapters");
                    onClose();
                },
                disabled: !currentStoryId
            },
            {
                id: "tool-lorebook",
                label: "Go to Lorebook",
                category: "Tools",
                keywords: ["lorebook", "entries", "tool", "navigate"],
                icon: <Tags className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentTool("lorebook");
                    onClose();
                },
                disabled: !currentStoryId
            },
            {
                id: "tool-brainstorm",
                label: "Go to Brainstorm",
                category: "Tools",
                keywords: ["brainstorm", "chat", "ai", "tool", "navigate"],
                icon: <MessageSquare className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentTool("brainstorm");
                    onClose();
                },
                disabled: !currentStoryId
            },
            {
                id: "tool-prompts",
                label: "Go to Prompts",
                category: "Tools",
                keywords: ["prompts", "tool", "navigate"],
                icon: <FileCode className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentTool("prompts");
                    onClose();
                }
            },
            {
                id: "tool-notes",
                label: "Go to Notes",
                category: "Tools",
                keywords: ["notes", "tool", "navigate"],
                icon: <StickyNote className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentTool("notes");
                    onClose();
                },
                disabled: !currentStoryId
            }
        ],
        [currentStoryId, setCurrentTool, onClose]
    );

    const storyCommands = useMemo(
        () =>
            stories.map(story => ({
                id: `story-${story.id}`,
                label: `Open: ${story.title}`,
                category: "Stories",
                keywords: ["story", "open", story.title],
                icon: <BookOpen className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentStoryId(story.id);
                    setCurrentTool("editor");
                    onClose();
                }
            })),
        [stories, setCurrentStoryId, setCurrentTool, onClose]
    );

    const chapterCommands = useMemo(
        () =>
            chapters.map((chapter, idx) => ({
                id: `chapter-${chapter.id}`,
                label: `Jump to: ${chapter.title || `Chapter ${idx + 1}`}`,
                category: "Chapters",
                keywords: ["chapter", "jump", chapter.title || ""],
                icon: <FileText className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentChapterId(chapter.id);
                    setCurrentTool("editor");
                    onClose();
                }
            })),
        [chapters, setCurrentChapterId, setCurrentTool, onClose]
    );

    const lorebookCommands = useMemo(
        () =>
            lorebookEntries.slice(0, 50).map((entry: LorebookEntry) => ({
                id: `lorebook-${entry.id}`,
                label: `View: ${entry.name}`,
                category: "Lorebook",
                keywords: ["lorebook", "entry", entry.name, entry.category],
                icon: <Tags className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentTool("lorebook");
                    onClose();
                }
            })),
        [lorebookEntries, setCurrentTool, onClose]
    );

    const promptCommands = useMemo(
        () =>
            prompts
                .filter(p => !p.isSystem)
                .slice(0, 30)
                .map(prompt => ({
                    id: `prompt-${prompt.id}`,
                    label: `Edit: ${prompt.name}`,
                    category: "Prompts",
                    keywords: ["prompt", "edit", prompt.name],
                    icon: <FileCode className="h-4 w-4 mr-2" />,
                    action: () => {
                        setCurrentTool("prompts");
                        onClose();
                    }
                })),
        [prompts, setCurrentTool, onClose]
    );

    const noteCommands = useMemo(
        () =>
            notes.slice(0, 30).map((note: Note) => ({
                id: `note-${note.id}`,
                label: `Open: ${note.title}`,
                category: "Notes",
                keywords: ["note", "open", note.title],
                icon: <StickyNote className="h-4 w-4 mr-2" />,
                action: () => {
                    setCurrentTool("notes");
                    onClose();
                }
            })),
        [notes, setCurrentTool, onClose]
    );

    const actionCommands = useMemo(
        () => [
            {
                id: "action-guide",
                label: "Open User Guide",
                category: "Actions",
                keywords: ["guide", "help", "documentation"],
                icon: <HelpCircle className="h-4 w-4 mr-2" />,
                action: () => {
                    navigate("/guide");
                    onClose();
                }
            }
        ],
        [onClose, navigate]
    );

    return useMemo(() => {
        const allCommands: CommandItem[] = [
            ...toolCommands,
            ...storyCommands,
            ...chapterCommands,
            ...lorebookCommands,
            ...promptCommands,
            ...noteCommands,
            ...actionCommands
        ];

        const groups = new Map<string, CommandItem[]>();
        allCommands.forEach(cmd => {
            if (cmd.disabled) return;
            const existing = groups.get(cmd.category) || [];
            groups.set(cmd.category, [...existing, cmd]);
        });

        return groups;
    }, [toolCommands, storyCommands, chapterCommands, lorebookCommands, promptCommands, noteCommands, actionCommands]);
};
