import { Edit2, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Note } from "@/types/story";
import { getNoteTypeLabel } from "./NoteFormDialog";

interface NoteListItemProps {
    note: Note;
    isSelected: boolean;
    onSelect: () => void;
    onEdit: (e: MouseEvent) => void;
    onDelete: (e: MouseEvent) => void;
}

export const NoteListItem = ({ note, isSelected, onSelect, onEdit, onDelete }: NoteListItemProps) => (
    <li
        role="option"
        tabIndex={0}
        aria-selected={isSelected}
        className={cn(
            "p-4 border-b border-input hover:bg-muted cursor-pointer relative group",
            isSelected && "bg-muted/50"
        )}
        onClick={onSelect}
        onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") onSelect();
        }}
    >
        <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium truncate">{note.title}</span>
                <span className="text-xs text-muted-foreground">{getNoteTypeLabel(note.type)}</span>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{new Date(note.updatedAt).toLocaleDateString()}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" onClick={onEdit} className="h-6 w-6">
                        <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onDelete} className="h-6 w-6 hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </div>
            </div>
        </div>
    </li>
);
