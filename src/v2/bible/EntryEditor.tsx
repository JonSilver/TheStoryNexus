import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useCreateLorebookMutation, useUpdateLorebookMutation } from "@/features/lorebook/hooks/useLorebookQuery";
import type { LorebookEntry } from "@/types/story";
import { randomUUID } from "@/utils/crypto";

const CATEGORIES = [
    "character",
    "location",
    "item",
    "event",
    "note",
    "synopsis",
    "starting scenario",
    "timeline"
] as const;

/**
 * Manual entry create/edit — extraction must never be the only door into
 * the bible. Level is chosen at creation (story / series when the story is
 * in one / global) and fixed thereafter; scope follows the level.
 */
export const EntryEditor = ({
    entry,
    storyId,
    seriesId,
    onClose
}: {
    entry: LorebookEntry | null;
    storyId: string;
    seriesId: string | null;
    onClose: () => void;
}) => {
    const createEntry = useCreateLorebookMutation();
    const updateEntry = useUpdateLorebookMutation();
    const [name, setName] = useState(entry?.name ?? "");
    const [category, setCategory] = useState<string>(entry?.category ?? "character");
    const [level, setLevel] = useState<string>(entry?.level ?? "story");
    const [description, setDescription] = useState(entry?.description ?? "");
    const [tags, setTags] = useState((Array.isArray(entry?.tags) ? entry.tags : []).join(", "));

    const save = () => {
        const payload = {
            name: name.trim(),
            category: category as LorebookEntry["category"],
            description: description.trim(),
            tags: tags
                .split(",")
                .map(t => t.trim())
                .filter(Boolean)
        };
        if (!payload.name) return;
        const done = { onSuccess: onClose, onError: () => toast.error("Couldn't save the entry") };
        if (entry) updateEntry.mutate({ id: entry.id, data: payload }, done);
        else
            createEntry.mutate(
                {
                    id: randomUUID(),
                    level: level as LorebookEntry["level"],
                    scopeId: level === "story" ? storyId : level === "series" ? (seriesId ?? undefined) : undefined,
                    isDisabled: false,
                    ...payload
                },
                done
            );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
            role="dialog"
            aria-label="Bible entry"
        >
            <div className="flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                <header className="flex items-center justify-between px-4 py-3">
                    <span className="font-medium">{entry ? `Edit “${entry.name}”` : "New bible entry"}</span>
                    <button type="button" onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </header>
                <div className="space-y-2 overflow-y-auto px-4 pb-4 text-sm">
                    <input
                        className="w-full rounded-md border bg-background px-3 py-2"
                        placeholder="Name"
                        aria-label="Entry name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <select
                            className="rounded-md border bg-background px-2 py-1.5"
                            aria-label="Category"
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                        >
                            {CATEGORIES.map(c => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                        {!entry && (
                            <select
                                className="rounded-md border bg-background px-2 py-1.5"
                                aria-label="Level"
                                value={level}
                                onChange={e => setLevel(e.target.value)}
                            >
                                <option value="story">this story</option>
                                {seriesId && <option value="series">whole series</option>}
                                <option value="global">all stories</option>
                            </select>
                        )}
                    </div>
                    <textarea
                        className="min-h-28 w-full resize-y rounded-md border bg-background p-2"
                        placeholder="Description — the facts the AI should know…"
                        aria-label="Description"
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                    />
                    <input
                        className="w-full rounded-md border bg-background px-3 py-2"
                        placeholder="Aliases / tags, comma-separated (e.g. the captain, Mrs D)"
                        aria-label="Tags"
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                    />
                </div>
                <footer className="flex gap-2 border-t p-3">
                    <button
                        type="button"
                        onClick={save}
                        disabled={!name.trim() || createEntry.isPending || updateEntry.isPending}
                        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
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
