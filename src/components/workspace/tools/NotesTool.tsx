import { Check, ChevronsUpDown, Plus, StickyNote } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import NoteEditor from "@/features/notes/components/NoteEditor";
import NoteList from "@/features/notes/components/NoteList";
import { useCreateNoteMutation, useNotesByStoryQuery } from "@/features/notes/hooks/useNotesQuery";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import { cn } from "@/lib/utils";
import type { Note } from "@/types/story";

export const NotesTool = () => {
    const { currentStoryId } = useStoryContext();
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const { data: notes = [] } = useNotesByStoryQuery(currentStoryId || "");
    const createNoteMutation = useCreateNoteMutation();

    const selectedNote = notes.find(n => n.id === selectedNoteId) || null;

    const handleSelectNote = (note: Note | null) => {
        setSelectedNoteId(note?.id || null);
    };

    const handleCreateNote = () => {
        if (!currentStoryId) return;
        createNoteMutation.mutate(
            {
                storyId: currentStoryId,
                title: `New Note ${new Date().toLocaleString()}`,
                content: "",
                type: "idea"
            },
            {
                onSuccess: newNote => {
                    setSelectedNoteId(newNote.id);
                    setMobileOpen(false);
                }
            }
        );
    };

    if (!currentStoryId) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">No story selected</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col md:flex-row">
            {/* Mobile: dropdown note selector */}
            <div className="md:hidden p-2 border-b flex gap-2">
                <Popover open={mobileOpen} onOpenChange={setMobileOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="flex-1 justify-between">
                            <span className="truncate">{selectedNote ? selectedNote.title : "Select note..."}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[calc(100vw-2rem)] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search notes..." />
                            <CommandList>
                                <CommandEmpty>No notes found.</CommandEmpty>
                                <CommandGroup>
                                    {notes.map(note => (
                                        <CommandItem
                                            key={note.id}
                                            value={note.title}
                                            onSelect={() => {
                                                handleSelectNote(note);
                                                setMobileOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedNoteId === note.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <span className="truncate">{note.title}</span>
                                            <span className="ml-2 text-xs text-muted-foreground capitalize">
                                                {note.type}
                                            </span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <Button size="icon" onClick={handleCreateNote} title="New Note">
                    <Plus className="h-4 w-4" />
                </Button>
            </div>

            {/* Desktop: sidebar */}
            <div className="hidden md:block">
                <NoteList storyId={currentStoryId} selectedNoteId={selectedNoteId} onSelectNote={handleSelectNote} />
            </div>

            <div className="flex-1 min-h-0">
                {selectedNoteId ? (
                    <NoteEditor key={selectedNoteId} selectedNoteId={selectedNoteId} />
                ) : (
                    <div className="flex items-center justify-center h-full flex-col gap-6 text-muted-foreground p-4">
                        <StickyNote className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/50" />
                        <div className="text-center max-w-md">
                            <h3 className="text-lg md:text-xl font-semibold mb-2">No Note Selected</h3>
                            <p className="mb-6 text-sm md:text-base">Select a note or create a new one.</p>
                            <Button onClick={handleCreateNote} className="flex items-center gap-2">
                                <Plus className="h-4 w-4" />
                                Create New Note
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
