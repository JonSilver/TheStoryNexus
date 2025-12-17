import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Note } from "@/types/story";

const NOTE_TYPES: Array<{ value: Note["type"]; label: string }> = [
    { value: "idea", label: "Idea" },
    { value: "research", label: "Research" },
    { value: "todo", label: "To-Do" },
    { value: "other", label: "Other" }
];

interface NoteFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    submitLabel: string;
    initialTitle?: string;
    initialType?: Note["type"];
    onSubmit: (title: string, type: Note["type"]) => void;
}

export const NoteFormDialog = ({
    open,
    onOpenChange,
    title,
    submitLabel,
    initialTitle = "",
    initialType = "idea",
    onSubmit
}: NoteFormDialogProps) => {
    const [noteTitle, setNoteTitle] = useState(initialTitle);
    const [noteType, setNoteType] = useState<Note["type"]>(initialType);

    useEffect(() => {
        if (open) {
            setNoteTitle(initialTitle);
            setNoteType(initialType);
        }
    }, [open, initialTitle, initialType]);

    const handleSubmit = () => {
        if (noteTitle.trim()) {
            onSubmit(noteTitle.trim(), noteType);
            setNoteTitle("");
            setNoteType("idea");
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <Input
                        value={noteTitle}
                        onChange={e => setNoteTitle(e.target.value)}
                        placeholder="Note title"
                        className="w-full"
                    />
                    <Select value={noteType} onValueChange={value => setNoteType(value as Note["type"])}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select note type" />
                        </SelectTrigger>
                        <SelectContent>
                            {NOTE_TYPES.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!noteTitle.trim()}>
                        {submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export const getNoteTypeLabel = (type: Note["type"]): string => {
    const found = NOTE_TYPES.find(t => t.value === type);
    return found?.label ?? "Other";
};
