import { attemptPromise } from "@jfdi/attempt";
import { Download } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { inRunningOrder } from "@/features/chapters/hooks/useChaptersQuery";
import { chaptersApi, storiesApi } from "@/services/api/client";
import type { Chapter } from "@/types/story";
import { downloadBlob } from "@/utils/download";
import { useConfirm } from "../components/Dialogs";
import { flushChapterSave, strandedContent } from "../editor/useChapterSaver";
import {
    blocksToHtml,
    blocksToMarkdown,
    blocksToPlainText,
    countUndecided,
    escapeHtmlText,
    parseSerialisedDocument
} from "../export";
import { uiState } from "../state/useV2Store";

type TextFormat = "md" | "txt" | "html";

const RENDERERS: Record<TextFormat, (chapters: Array<{ title: string; content: string }>) => string> = {
    md: chapters =>
        chapters.map(c => `# ${c.title}\n\n${blocksToMarkdown(parseSerialisedDocument(c.content))}`).join("\n\n"),
    txt: chapters =>
        chapters.map(c => `${c.title}\n\n${blocksToPlainText(parseSerialisedDocument(c.content))}`).join("\n\n\n"),
    html: chapters =>
        chapters
            .map(c => `<h1>${escapeHtmlText(c.title)}</h1>\n${blocksToHtml(parseSerialisedDocument(c.content))}`)
            .join("\n")
};

const MIME: Record<TextFormat, string> = { md: "text/markdown", txt: "text/plain", html: "text/html" };

const textFile =
    (format: TextFormat) =>
    async (_storyId: string, chapters: Chapter[]): Promise<Blob> =>
        new Blob([RENDERERS[format](chapters)], { type: `${MIME[format]};charset=utf-8` });

interface ExportTarget {
    label: string;
    extension: string;
    hint?: string;
    /** Server-built files stay real links (open in new tab, copy address); a click still goes through `exportAs`. */
    href?: (storyId: string) => string;
    /** Leaves scene-beat takes and ghost suggestions out, so undecided drafts need a warning first. */
    omitsDrafts: boolean;
    file: (storyId: string, chapters: Chapter[]) => Promise<Blob>;
}

const TARGETS: ExportTarget[] = [
    { label: "Markdown", extension: "md", omitsDrafts: true, file: textFile("md") },
    { label: "Text", extension: "txt", omitsDrafts: true, file: textFile("txt") },
    { label: "HTML", extension: "html", omitsDrafts: true, file: textFile("html") },
    {
        label: "EPUB",
        extension: "epub",
        omitsDrafts: true,
        href: id => `/api/stories/${id}/epub`,
        file: storiesApi.epub
    },
    {
        label: "JSON (backup)",
        extension: "story.json",
        hint: "Full story data: chapters, bible, notes, chats, AI overrides — re-importable",
        omitsDrafts: false,
        href: id => `/api/stories/${id}/export`,
        file: storiesApi.backup
    }
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Whole-story export: every format carries the last keystrokes, and warns before leaving drafts out. */
export const ExportButtons = ({ storyId }: { storyId: string }) => {
    const { lastChapterFor } = uiState;
    const confirm = useConfirm();
    // Anything visible on screen but missing from the file — undecided takes and
    // ghosts, edits a closed chapter couldn't save — is the writer's to choose, not discover
    const confirmGaps = async (chapters: Chapter[], omitsDrafts: boolean): Promise<boolean> => {
        const counts = omitsDrafts ? chapters.map(c => ({ title: c.title, undecided: countUndecided(c.content) })) : [];
        const undecided = counts.reduce((sum, c) => sum + (c.undecided ?? 0), 0);
        const unreadable = counts.filter(c => c.undecided === null).map(c => `“${c.title}”`);
        const unsaved = chapters.filter(c => strandedContent(c.id) !== undefined).map(c => `“${c.title}”`);
        if (undecided === 0 && unreadable.length === 0 && unsaved.length === 0) return true;
        const message = [
            unsaved.length > 0 &&
                `Your last edits to ${unsaved.join(", ")} haven't been saved, so they won't be included — open the chapter to save them first.`,
            undecided > 0 &&
                `${plural(undecided, "unaccepted AI draft")} (scene-beat takes or pending suggestions) won't be included.`,
            unreadable.length > 0 &&
                `Couldn't check ${unreadable.join(", ")} for unaccepted AI drafts — any there won't be included.`,
            "Export anyway?"
        ]
            .filter(Boolean)
            .join(" ");
        return confirm({ message, confirmLabel: "Export anyway" });
    };

    const [busy, setBusy] = useState<string | null>(null);
    const exportAs = async (target: ExportTarget) => {
        if (busy) return;
        setBusy(target.label);
        const [error, result] = await attemptPromise(async () => {
            // The file must contain the last keystrokes, not race the debounce
            const openChapter = lastChapterFor(storyId);
            if (openChapter) await flushChapterSave(openChapter);
            const [story, chapters] = await Promise.all([
                storiesApi.getById(storyId),
                chaptersApi.getByStory(storyId).then(inRunningOrder)
            ]);
            if (!(await confirmGaps(chapters, target.omitsDrafts))) return null;
            return { story, blob: await target.file(storyId, chapters) };
        });
        setBusy(null);
        if (error) {
            toast.error(`${target.label} export failed: ${error.message}`);
            return;
        }
        if (!result) return;
        downloadBlob(result.story.title, target.extension, result.blob);
    };

    return (
        <section className="border-t px-4 py-3">
            <h2 className="mb-2 flex items-center gap-2 font-medium">
                <Download className="h-4 w-4 text-muted-foreground" /> Export story
            </h2>
            <div className="flex flex-wrap gap-2">
                {TARGETS.map(target =>
                    target.href ? (
                        <a
                            key={target.label}
                            href={target.href(storyId)}
                            title={target.hint}
                            aria-disabled={busy !== null}
                            onClick={event => {
                                // Open-in-new-tab and friends keep the browser's own download
                                if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
                                event.preventDefault();
                                void exportAs(target);
                            }}
                            className="rounded-md border px-3 py-1.5 text-sm aria-disabled:opacity-50"
                        >
                            {busy === target.label ? "Preparing…" : target.label}
                        </a>
                    ) : (
                        <button
                            key={target.label}
                            type="button"
                            title={target.hint}
                            disabled={busy !== null}
                            onClick={() => void exportAs(target)}
                            className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-50"
                        >
                            {busy === target.label ? "Preparing…" : target.label}
                        </button>
                    )
                )}
            </div>
        </section>
    );
};
