import { Command } from "cmdk";
import { BookOpen, FileCode, FileText, HelpCircle, MessageSquare, StickyNote, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { useNotesByStoryQuery } from "@/features/notes/hooks/useNotesQuery";
import { usePromptsQuery } from "@/features/prompts/hooks/usePromptsQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";
import type { LorebookEntry, Note } from "@/types/story";

interface CommandItem {
    id: string;
    label: string;
    category: string;
    keywords: string[];
    icon: React.ReactNode;
    action: () => void;
    disabled?: boolean;
}

interface CommandPaletteProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
    const { currentStoryId, setCurrentStoryId, setCurrentChapterId, setCurrentTool } = useStoryContext();
    const navigate = useNavigate();

    const [search, setSearch] = useState("");

    const { data: stories = [] } = useStoriesQuery();
    const { data: chapters = [] } = useChaptersByStoryQuery(currentStoryId || "");
    const { data: lorebookEntries = [] } = useStoryLorebookQuery(currentStoryId || "");
    const { data: prompts = [] } = usePromptsQuery();
    const { data: notes = [] } = useNotesByStoryQuery(currentStoryId || "");

    // Reset search when dialog opens
    useEffect(() => {
        if (open) {
            setSearch("");
        }
    }, [open]);

    // Tool navigation commands
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
                    onOpenChange(false);
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
                    onOpenChange(false);
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
                    onOpenChange(false);
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
                    onOpenChange(false);
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
                    onOpenChange(false);
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
                    onOpenChange(false);
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
                    onOpenChange(false);
                },
                disabled: !currentStoryId
            }
        ],
        [currentStoryId, setCurrentTool, onOpenChange]
    );

    // Story commands
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
                    onOpenChange(false);
                }
            })),
        [stories, setCurrentStoryId, setCurrentTool, onOpenChange]
    );

    // Chapter commands
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
                    onOpenChange(false);
                }
            })),
        [chapters, setCurrentChapterId, setCurrentTool, onOpenChange]
    );

    // Lorebook commands
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
                    onOpenChange(false);
                    // TODO: scroll to entry or set selected entry
                }
            })),
        [lorebookEntries, setCurrentTool, onOpenChange]
    );

    // Prompt commands
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
                        onOpenChange(false);
                        // TODO: scroll to prompt or set selected prompt
                    }
                })),
        [prompts, setCurrentTool, onOpenChange]
    );

    // Note commands
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
                    onOpenChange(false);
                    // TODO: scroll to note or set selected note
                }
            })),
        [notes, setCurrentTool, onOpenChange]
    );

    // Global action commands
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
                    onOpenChange(false);
                }
            }
        ],
        [onOpenChange]
    );

    // Combine all commands
    const allCommands: CommandItem[] = useMemo(
        () => [
            ...toolCommands,
            ...storyCommands,
            ...chapterCommands,
            ...lorebookCommands,
            ...promptCommands,
            ...noteCommands,
            ...actionCommands
        ],
        [toolCommands, storyCommands, chapterCommands, lorebookCommands, promptCommands, noteCommands, actionCommands]
    );

    // Group commands by category
    const commandsByCategory = useMemo(() => {
        const groups = new Map<string, CommandItem[]>();

        allCommands.forEach(cmd => {
            if (cmd.disabled) return;
            const existing = groups.get(cmd.category) || [];
            groups.set(cmd.category, [...existing, cmd]);
        });

        return groups;
    }, [allCommands]);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 max-w-2xl">
                <Command
                    className="rounded-lg border shadow-md"
                    shouldFilter={true}
                    value={search}
                    onValueChange={setSearch}
                >
                    <div className="flex items-center border-b px-3">
                        <Command.Input
                            placeholder="Type a command or search..."
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        />
                    </div>
                    <Command.List className="max-h-[400px] overflow-y-auto p-2">
                        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                            No results found.
                        </Command.Empty>

                        {Array.from(commandsByCategory.entries()).map(([category, commands]) => (
                            <Command.Group key={category} heading={category} className="mb-2">
                                {commands.map(cmd => (
                                    <Command.Item
                                        key={cmd.id}
                                        value={cmd.label}
                                        keywords={cmd.keywords}
                                        onSelect={() => cmd.action()}
                                        className="flex items-center px-2 py-2 cursor-pointer rounded-sm hover:bg-accent aria-selected:bg-accent"
                                    >
                                        {cmd.icon}
                                        <span>{cmd.label}</span>
                                    </Command.Item>
                                ))}
                            </Command.Group>
                        ))}
                    </Command.List>
                </Command>
            </DialogContent>
        </Dialog>
    );
};
