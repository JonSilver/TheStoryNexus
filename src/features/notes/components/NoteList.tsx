import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";
import type { Note } from "@/types/story";
import { useCreateNoteMutation, useDeleteNoteMutation, useNotesByStoryQuery, useUpdateNoteMutation } from "../hooks/useNotesQuery";
import { NoteFormDialog } from "./NoteFormDialog";
import { NoteListItem } from "./NoteListItem";

interface NoteListProps {
    storyId: string;
    selectedNoteId: string | null;
    onSelectNote: (note: Note | null) => void;
}

export default function NoteList({ storyId, selectedNoteId, onSelectNote }: NoteListProps) {
    const { data: notes = [] } = useNotesByStoryQuery(storyId);
    const createNoteMutation = useCreateNoteMutation();
    const updateNoteMutation = useUpdateNoteMutation();
    const deleteNoteMutation = useDeleteNoteMutation();

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isNewNoteDialogOpen, setIsNewNoteDialogOpen] = useState(false);
    const [editingNote, setEditingNote] = useState<Note | null>(null);

    const handleDeleteNote = async (noteId: string) => {
        await deleteNoteMutation.mutateAsync(noteId);
        if (selectedNoteId === noteId) onSelectNote(null);
    };

    const handleEditClick = (note: Note, e: MouseEvent) => {
        e.stopPropagation();
        setEditingNote(note);
        setIsEditDialogOpen(true);
    };

    const handleCreateNote = async (title: string, type: Note["type"]) => {
        await createNoteMutation.mutateAsync({ storyId, title, content: "", type });
        setIsNewNoteDialogOpen(false);
    };

    const handleSaveEdit = async (title: string, type: Note["type"]) => {
        if (editingNote)
            await updateNoteMutation.mutateAsync({ id: editingNote.id, data: { title, type } });
        setIsEditDialogOpen(false);
        setEditingNote(null);
    };

    return (
        <div
            className={cn(
                "relative border-r border-input bg-background transition-all duration-300",
                isCollapsed ? "w-[40px]" : "w-[250px] sm:w-[300px]"
            )}
        >
            <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-1/2 transform -translate-y-1/2 z-10
                    bg-background border-input border rounded-full p-1 shadow-sm hover:bg-muted"
            >
                {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 text-foreground" />
                ) : (
                    <ChevronLeft className="h-4 w-4 text-foreground" />
                )}
            </button>

            <div className={cn("h-full overflow-y-auto", isCollapsed ? "hidden" : "block")}>
                <div className="p-4 border-b border-input">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="font-semibold text-foreground">Notes</h2>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsNewNoteDialogOpen(true)}
                            className="flex items-center gap-1"
                        >
                            <Plus className="h-4 w-4" />
                            New Note
                        </Button>
                    </div>
                </div>
                <ul className="overflow-y-auto flex-1">
                    {notes.length === 0 ? (
                        <li>
                            <EmptyState
                                message="No notes yet"
                                actionLabel="Create Note"
                                onAction={() => setIsNewNoteDialogOpen(true)}
                                className="p-8"
                            />
                        </li>
                    ) : (
                        notes.map(note => (
                            <NoteListItem
                                key={note.id}
                                note={note}
                                isSelected={selectedNoteId === note.id}
                                onSelect={() => onSelectNote(note)}
                                onEdit={e => handleEditClick(note, e)}
                                onDelete={e => {
                                    e.stopPropagation();
                                    handleDeleteNote(note.id);
                                }}
                            />
                        ))
                    )}
                </ul>
            </div>

            <NoteFormDialog
                open={isNewNoteDialogOpen}
                onOpenChange={setIsNewNoteDialogOpen}
                title="Create New Note"
                submitLabel="Create"
                onSubmit={handleCreateNote}
            />

            <NoteFormDialog
                open={isEditDialogOpen}
                onOpenChange={setIsEditDialogOpen}
                title="Edit Note"
                submitLabel="Save"
                initialTitle={editingNote?.title}
                initialType={editingNote?.type}
                onSubmit={handleSaveEdit}
            />
        </div>
    );
}
