import { useState } from "react";
import NoteEditor from "@/features/notes/components/NoteEditor";
import NoteList from "@/features/notes/components/NoteList";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import type { Note } from "@/types/story";

export const NotesTool = () => {
    const { currentStoryId } = useStoryContext();
    const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

    const handleSelectNote = (note: Note | null) => {
        setSelectedNoteId(note?.id || null);
    };

    if (!currentStoryId) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-muted-foreground">No story selected</p>
            </div>
        );
    }

    return (
        <div className="h-full flex">
            <NoteList storyId={currentStoryId} selectedNoteId={selectedNoteId} onSelectNote={handleSelectNote} />
            <div className="flex-1">
                <NoteEditor key={selectedNoteId} selectedNoteId={selectedNoteId} />
            </div>
        </div>
    );
};
