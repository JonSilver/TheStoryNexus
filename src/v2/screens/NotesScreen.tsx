import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import {
    useCreateNoteMutation,
    useDeleteNoteMutation,
    useNotesByStoryQuery,
    useUpdateNoteMutation
} from "@/features/notes/hooks/useNotesQuery";
import type { Note } from "@/types/story";
import type { ScreenProps } from "../V2App";
import { MarkdownView } from "../components/MarkdownView";
import { useV2Store } from "../state/useV2Store";

const NOTE_TYPES = ["idea", "research", "todo", "other"] as const;

const NoteEditor = ({ note, storyId, onClose }: { note: Note | null; storyId: string; onClose: () => void }) => {
    const createNote = useCreateNoteMutation();
    const updateNote = useUpdateNoteMutation();
    const [title, setTitle] = useState(note?.title ?? "");
    const [content, setContent] = useState(note?.content ?? "");
    const [type, setType] = useState<Note["type"]>(note?.type ?? "idea");
    // Existing notes open in reading mode — markdown rendered, not raw
    const [previewing, setPreviewing] = useState(Boolean(note?.content));

    const save = () => {
        const data = { title: title.trim() || "Untitled", content, type };
        if (note) updateNote.mutate({ id: note.id, data }, { onSuccess: onClose });
        else createNote.mutate({ storyId, ...data }, { onSuccess: onClose });
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" role="dialog" aria-label="Note">
            <div className="flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                <header className="flex items-center justify-between px-4 py-3">
                    <span className="font-medium">{note ? "Edit note" : "New note"}</span>
                    <button type="button" onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </header>
                <div className="space-y-2 overflow-y-auto px-4 pb-4">
                    <input
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder="Title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                    />
                    <select
                        className="rounded-md border bg-background px-2 py-1.5 text-sm"
                        value={type}
                        onChange={e => setType(e.target.value as Note["type"])}
                    >
                        {NOTE_TYPES.map(t => (
                            <option key={t} value={t}>
                                {t}
                            </option>
                        ))}
                    </select>
                    <div className="flex gap-1 text-xs">
                        <button
                            type="button"
                            onClick={() => setPreviewing(false)}
                            className={`rounded-md border px-2 py-1 ${previewing ? "" : "bg-accent"}`}
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            onClick={() => setPreviewing(true)}
                            className={`rounded-md border px-2 py-1 ${previewing ? "bg-accent" : ""}`}
                        >
                            Preview
                        </button>
                    </div>
                    {previewing ? (
                        <div className="min-h-40 rounded-md border p-3 text-sm">
                            <MarkdownView>{content || "*Nothing yet.*"}</MarkdownView>
                        </div>
                    ) : (
                        <textarea
                            className="min-h-40 w-full resize-y rounded-md border bg-background p-2 text-sm"
                            placeholder="Write your note… (markdown supported)"
                            value={content}
                            onChange={e => setContent(e.target.value)}
                        />
                    )}
                </div>
                <footer className="flex gap-2 border-t p-3">
                    <button
                        type="button"
                        onClick={save}
                        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                    >
                        Save
                    </button>
                    <button type="button" onClick={onClose} className="rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </button>
                </footer>
            </div>
        </div>
    );
};

export const NotesScreen = ({ goTo }: ScreenProps) => {
    const { currentStoryId } = useV2Store();
    const { data: notes } = useNotesByStoryQuery(currentStoryId ?? "");
    const deleteNote = useDeleteNoteMutation();
    const [editing, setEditing] = useState<Note | null | "new">(null);

    if (!currentStoryId)
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                <p className="text-muted-foreground">Pick a story first.</p>
                <button
                    type="button"
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                    onClick={() => goTo("library")}
                >
                    Choose a story
                </button>
            </div>
        );

    return (
        <div className="flex h-full flex-col">
            <header className="flex items-center gap-2 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
                <button type="button" onClick={() => goTo("story")} aria-label="Back">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <h1 className="text-lg font-semibold">Notes</h1>
                <button type="button" onClick={() => setEditing("new")} aria-label="New note" className="ml-auto">
                    <Plus className="h-5 w-5" />
                </button>
            </header>
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
                {(notes ?? []).map(note => (
                    <li key={note.id} className="flex items-start gap-2 px-4 py-3">
                        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(note)}>
                            <p className="font-medium">
                                {note.title} <span className="text-xs text-muted-foreground">({note.type})</span>
                            </p>
                            <p className="line-clamp-2 text-sm text-muted-foreground">{note.content}</p>
                        </button>
                        <button
                            type="button"
                            onClick={() =>
                                window.confirm(`Delete the note “${note.title}”?`) && deleteNote.mutate(note.id)
                            }
                            aria-label={`Delete ${note.title}`}
                            className="mt-1 text-muted-foreground"
                        >
                            <Trash2 className="h-4 w-4" />
                        </button>
                    </li>
                ))}
                {(notes ?? []).length === 0 && (
                    <li className="p-8 text-center text-sm text-muted-foreground">No notes yet.</li>
                )}
            </ul>
            {editing && (
                <NoteEditor
                    note={editing === "new" ? null : editing}
                    storyId={currentStoryId}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    );
};
