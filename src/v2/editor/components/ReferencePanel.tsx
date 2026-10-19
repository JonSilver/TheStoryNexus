import { NotebookPen, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import { ideaNote, useCreateNoteMutation } from "@/features/notes/hooks/useNotesQuery";
import { entryMatches } from "../../bible/duplicates";

/**
 * The mid-writing reference surface: consulting the bible or jotting a note
 * must never cost the writer their place in the manuscript. Right-hand
 * slide-over on wide screens (the page stays visible), bottom sheet on
 * mobile. Read-only lookups — full editing lives on the Bible screen.
 */
export const ReferencePanel = ({ storyId, onClose }: { storyId: string; onClose: () => void }) => {
    const { data: entries } = useHierarchicalLorebookQuery(storyId);
    const createNote = useCreateNoteMutation();
    const [search, setSearch] = useState("");
    const [note, setNote] = useState("");

    const matches = (entries ?? []).filter(e => entryMatches(e, search));

    const saveNote = () => {
        const content = note.trim();
        if (!content) return;
        createNote.mutate(ideaNote(storyId, content), {
            onSuccess: () => {
                setNote("");
                toast.success("Noted");
            }
        });
    };

    return (
        <div
            className="fixed inset-0 z-40 flex flex-col justify-end bg-black/20 md:absolute md:inset-y-0 md:right-0 md:left-auto md:w-80 md:bg-transparent"
            onClick={onClose}
        >
            <div
                role="complementary"
                aria-label="Reference"
                className="flex max-h-[70dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)] md:h-full md:max-h-none md:rounded-none md:border-l md:border-t-0 md:shadow-lg"
                onClick={e => e.stopPropagation()}
            >
                <header className="flex items-center gap-2 border-b px-3 py-2">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                        placeholder="Search the bible…"
                        aria-label="Search the bible"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                    <button type="button" onClick={onClose} aria-label="Close reference panel">
                        <X className="h-4 w-4" />
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    {matches.map(entry => (
                        <details key={entry.id} className="border-b px-3 py-2 text-sm">
                            <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                <span className="font-medium">{entry.name}</span>{" "}
                                <span className="text-xs text-muted-foreground">({entry.category})</span>
                            </summary>
                            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{entry.description}</p>
                            {Array.isArray(entry.tags) && entry.tags.length > 0 && (
                                <p className="mt-1 text-xs text-muted-foreground">aka: {entry.tags.join(", ")}</p>
                            )}
                        </details>
                    ))}
                    {matches.length === 0 && (
                        <p className="p-4 text-center text-sm text-muted-foreground">
                            {search.trim() ? "Nothing matches." : "No bible entries yet."}
                        </p>
                    )}
                </div>

                <footer className="border-t p-2">
                    <div className="flex items-end gap-2">
                        <textarea
                            className="max-h-24 min-h-10 flex-1 resize-y rounded-md border bg-background px-2 py-1.5 text-sm"
                            placeholder="Quick note…"
                            aria-label="Quick note"
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                        <button
                            type="button"
                            onClick={saveNote}
                            disabled={!note.trim() || createNote.isPending}
                            aria-label="Save quick note"
                            className="rounded-md border p-2 disabled:opacity-50"
                        >
                            <NotebookPen className="h-4 w-4" />
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
};
