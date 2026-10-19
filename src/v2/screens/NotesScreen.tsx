import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
    useCreateNoteMutation,
    useDeleteNoteMutation,
    useNotesByStoryQuery,
    useUpdateNoteMutation
} from "@/features/notes/hooks/useNotesQuery";
import type { Note } from "@/types/story";
import { BottomSheet } from "../components/BottomSheet";
import { useGuardedClose } from "../components/Dialogs";
import { useConfirm } from "../components/Dialogs";
import { MarkdownView } from "../components/MarkdownView";
import { ScreenHeader, NoStoryChosen } from "../components/ScreenParts";
import { useNav } from "../routing";
import { useCurrentStoryId } from "../state/useV2Store";

const NOTE_TYPES = ["idea", "research", "todo", "other"] as const;

const NoteEditor = ({ note, storyId, onClose }: { note: Note | null; storyId: string; onClose: () => void }) => {
    const createNote = useCreateNoteMutation();
    const updateNote = useUpdateNoteMutation();
    const [title, setTitle] = useState(note?.title ?? "");
    const [content, setContent] = useState(note?.content ?? "");
    const [type, setType] = useState<Note["type"]>(note?.type ?? "idea");
    // Existing notes open in reading mode — markdown rendered, not raw
    const [previewing, setPreviewing] = useState(Boolean(note?.content));
    const dirty = title !== (note?.title ?? "") || content !== (note?.content ?? "") || type !== (note?.type ?? "idea");
    const close = useGuardedClose(dirty, onClose);

    const save = () => {
        const data = { title: title.trim() || "Untitled", content, type };
        if (note) updateNote.mutate({ id: note.id, data }, { onSuccess: onClose });
        else createNote.mutate({ storyId, ...data }, { onSuccess: onClose });
    };

    return (
        <BottomSheet
            title={note ? "Edit note" : "New note"}
            onClose={close}
            bodyClassName="space-y-2 px-4 pb-4"
            footer={
                <>
                    <button
                        type="button"
                        onClick={save}
                        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
                    >
                        Save
                    </button>
                    <button type="button" onClick={close} className="rounded-md border px-4 py-2 text-sm">
                        Cancel
                    </button>
                </>
            }
        >
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
        </BottomSheet>
    );
};

export const NotesScreen = () => {
    const { goTo, goBack } = useNav();
    const currentStoryId = useCurrentStoryId();
    const { data: notes } = useNotesByStoryQuery(currentStoryId ?? "");
    const deleteNote = useDeleteNoteMutation();
    const confirm = useConfirm();
    // The id, not a copy: the editor sees the note as it is now, and closes if it's gone
    const [editingId, setEditingId] = useState<string | null | "new">(null);
    const editing = (notes ?? []).find(n => n.id === editingId) ?? null;

    if (!currentStoryId) return <NoStoryChosen onChoose={() => goTo("library")} />;

    return (
        <div className="flex h-full flex-col">
            <ScreenHeader title="Notes" onBack={() => goBack("story")}>
                <button type="button" onClick={() => setEditingId("new")} aria-label="New note">
                    <Plus className="h-5 w-5" />
                </button>
            </ScreenHeader>
            <ul className="min-h-0 flex-1 divide-y overflow-y-auto">
                {(notes ?? []).map(note => (
                    <li key={note.id} className="flex items-start gap-2 px-4 py-3">
                        <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() => setEditingId(note.id)}
                        >
                            <p className="font-medium">
                                {note.title} <span className="text-xs text-muted-foreground">({note.type})</span>
                            </p>
                            <p className="line-clamp-2 text-sm text-muted-foreground">{note.content}</p>
                        </button>
                        <button
                            type="button"
                            onClick={async () => {
                                if (
                                    await confirm({
                                        message: `Delete the note “${note.title}”?`,
                                        confirmLabel: "Delete"
                                    })
                                )
                                    deleteNote.mutate(note.id);
                            }}
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
            {(editingId === "new" || editing) && (
                <NoteEditor note={editing} storyId={currentStoryId} onClose={() => setEditingId(null)} />
            )}
        </div>
    );
};
