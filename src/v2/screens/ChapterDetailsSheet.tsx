import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { useUpdateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import type { Chapter } from "@/types/story";

const POV_TYPES = ["", "First Person", "Third Person Limited", "Third Person Omniscient"] as const;

/**
 * Chapter metadata that steers the AI but had no editing surface: POV
 * (the default for Continue and scene beats without their own), outline,
 * and the summary text itself. A hand-edited summary is marked fresh so
 * auto-summarise doesn't overwrite it.
 */
export const ChapterDetailsSheet = ({ chapter, onClose }: { chapter: Chapter; onClose: () => void }) => {
    const updateChapter = useUpdateChapterMutation();
    const { data: entries } = useHierarchicalLorebookQuery(chapter.storyId);
    const characters = (entries ?? []).filter(e => e.category === "character");
    const [title, setTitle] = useState(chapter.title);
    const [povType, setPovType] = useState(chapter.povType ?? "");
    const [povCharacter, setPovCharacter] = useState(chapter.povCharacter ?? "");
    const [outline, setOutline] = useState(chapter.outline?.content ?? "");
    const [summary, setSummary] = useState(chapter.summary ?? "");

    const save = () => {
        const summaryEdited = summary !== (chapter.summary ?? "");
        updateChapter.mutate(
            {
                id: chapter.id,
                data: {
                    title: title.trim() || chapter.title,
                    povType: (povType || null) as Chapter["povType"],
                    povCharacter: povCharacter || null,
                    outline: outline.trim() ? { content: outline, lastUpdated: new Date() } : null,
                    summary,
                    // Hand-edited summaries are authoritative for the current text
                    ...(summaryEdited ? { summarySourceRevision: chapter.revision ?? 0 } : {})
                } as Partial<Chapter>
            },
            { onSuccess: onClose, onError: () => toast.error("Couldn't save chapter details") }
        );
    };

    return (
        <div
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40"
            role="dialog"
            aria-label="Chapter details"
        >
            <div className="flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-background pb-[env(safe-area-inset-bottom)]">
                <header className="flex items-center justify-between px-4 py-3">
                    <span className="font-medium">Chapter details</span>
                    <button type="button" onClick={onClose} aria-label="Close">
                        <X className="h-4 w-4" />
                    </button>
                </header>
                <div className="space-y-2 overflow-y-auto px-4 pb-4 text-sm">
                    <input
                        className="w-full rounded-md border bg-background px-3 py-2"
                        aria-label="Chapter title"
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <select
                            className="rounded-md border bg-background px-2 py-1.5"
                            aria-label="Chapter POV type"
                            title="Default POV for Continue and scene beats in this chapter"
                            value={povType}
                            onChange={e => setPovType(e.target.value)}
                        >
                            {POV_TYPES.map(type => (
                                <option key={type} value={type}>
                                    {type || "POV: unset"}
                                </option>
                            ))}
                        </select>
                        <select
                            className="min-w-0 flex-1 rounded-md border bg-background px-2 py-1.5"
                            aria-label="Chapter POV character"
                            value={povCharacter}
                            onChange={e => setPovCharacter(e.target.value)}
                        >
                            <option value="">POV character…</option>
                            {characters.map(c => (
                                <option key={c.id} value={c.name}>
                                    {c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <textarea
                        className="min-h-24 w-full resize-y rounded-md border bg-background p-2"
                        aria-label="Outline"
                        placeholder="Outline — what should happen in this chapter…"
                        value={outline}
                        onChange={e => setOutline(e.target.value)}
                    />
                    <textarea
                        className="min-h-24 w-full resize-y rounded-md border bg-background p-2"
                        aria-label="Summary"
                        placeholder="Summary — what has happened (feeds later chapters' AI context)…"
                        value={summary}
                        onChange={e => setSummary(e.target.value)}
                    />
                </div>
                <footer className="flex gap-2 border-t p-3">
                    <button
                        type="button"
                        onClick={save}
                        disabled={updateChapter.isPending}
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
