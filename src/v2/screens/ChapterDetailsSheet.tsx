import { useState } from "react";
import { useUpdateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import { useHierarchicalLorebookQuery } from "@/features/lorebook/hooks/useLorebookQuery";
import type { Chapter } from "@/types/story";
import { BottomSheet } from "../components/BottomSheet";
import { useGuardedClose } from "../components/Dialogs";

const POV_TYPES = ["", "First Person", "Third Person Limited", "Third Person Omniscient"] as const;

const fieldsOf = (chapter: Chapter) => ({
    title: chapter.title,
    povType: chapter.povType ?? "",
    povCharacter: chapter.povCharacter ?? "",
    outline: chapter.outline?.content ?? "",
    summary: chapter.summary ?? "",
    summaryLocked: chapter.summaryLocked ?? false
});

type Fields = ReturnType<typeof fieldsOf>;

/**
 * Chapter metadata that steers the AI but had no editing surface: POV
 * (the default for Continue and scene beats without their own), outline,
 * and the summary text itself. A hand-edited summary is marked fresh so
 * auto-summarise doesn't overwrite it — and is LOCKED against background
 * refresh, which would otherwise replace it after the next prose edit.
 */
export const ChapterDetailsSheet = ({ chapter, onClose }: { chapter: Chapter; onClose: () => void }) => {
    const updateChapter = useUpdateChapterMutation();
    const { data: entries } = useHierarchicalLorebookQuery(chapter.storyId);
    const characters = (entries ?? []).filter(e => e.category === "character");
    // Save sends only what the writer changed since opening — a summary or
    // title that lands meanwhile (background summary, another device) survives
    const [opened] = useState(() => fieldsOf(chapter));
    const [title, setTitle] = useState(opened.title);
    const [povType, setPovType] = useState(opened.povType);
    const [povCharacter, setPovCharacter] = useState(opened.povCharacter);
    const [outline, setOutline] = useState(opened.outline);
    const [summary, setSummary] = useState(opened.summary);
    const [locked, setLocked] = useState(opened.summaryLocked);
    const form: Fields = { title, povType, povCharacter, outline, summary, summaryLocked: locked };
    const edited = (key: keyof Fields) => form[key] !== opened[key];
    const dirty = (Object.keys(form) as (keyof Fields)[]).some(edited);
    const close = useGuardedClose(dirty, onClose);

    const save = () => {
        const summaryEdited = edited("summary");
        const data = {
            ...(edited("title") && title.trim() ? { title: title.trim() } : {}),
            ...(edited("povType") ? { povType: (povType || null) as Chapter["povType"] } : {}),
            ...(edited("povCharacter") ? { povCharacter: povCharacter || null } : {}),
            ...(edited("outline")
                ? { outline: outline.trim() ? { content: outline, lastUpdated: new Date() } : null }
                : {}),
            // Hand-edited summaries are authoritative for the current text
            ...(summaryEdited ? { summary, summarySourceRevision: chapter.revision ?? 0 } : {}),
            ...(summaryEdited || edited("summaryLocked") ? { summaryLocked: locked && summary.trim().length > 0 } : {})
        } as Partial<Chapter>;
        if (Object.keys(data).length === 0) onClose();
        else updateChapter.mutate({ id: chapter.id, data }, { onSuccess: onClose });
    };

    return (
        <BottomSheet
            title="Chapter details"
            onClose={close}
            bodyClassName="space-y-2 px-4 pb-4 text-sm"
            footer={
                <>
                    <button
                        type="button"
                        onClick={save}
                        disabled={updateChapter.isPending}
                        className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
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
                onChange={e => {
                    setSummary(e.target.value);
                    // Writing it yourself means you want to keep it
                    setLocked(true);
                }}
            />
            {chapter.summary && (chapter.summarySourceRevision ?? -1) !== (chapter.revision ?? 0) && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                    Out of date — the chapter has changed substantially since this summary was written. Edit it here, or
                    use … → Summarise chapter in the editor.
                </p>
            )}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                    type="checkbox"
                    checked={locked}
                    onChange={e => setLocked(e.target.checked)}
                    aria-label="Keep this summary"
                />
                Keep this summary — don't refresh it automatically
            </label>
        </BottomSheet>
    );
};
