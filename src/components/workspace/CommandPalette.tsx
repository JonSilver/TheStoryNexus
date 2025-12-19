import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useChaptersByStoryQuery } from "@/features/chapters/hooks/useChaptersQuery";
import { useStoryLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { useNotesByStoryQuery } from "@/features/notes/hooks/useNotesQuery";
import { usePromptsQuery } from "@/features/prompts/hooks/usePromptsQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";
import { useCommandPaletteCommands } from "./useCommandPaletteCommands.tsx";

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

    useEffect(() => {
        if (open) setSearch("");
    }, [open]);

    const commandsByCategory = useCommandPaletteCommands({
        currentStoryId,
        stories,
        chapters,
        lorebookEntries,
        prompts,
        notes,
        setCurrentStoryId,
        setCurrentChapterId,
        setCurrentTool,
        onClose: () => onOpenChange(false),
        navigate
    });

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
