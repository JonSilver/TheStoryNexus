import { attemptPromise } from "@jfdi/attempt";
import { Download } from "lucide-react";
import { toast } from "react-toastify";
import { chaptersApi, storiesApi } from "@/services/api/client";
import { flushChapterSave } from "../editor/useChapterSaver";
import {
    blocksToHtml,
    blocksToMarkdown,
    blocksToPlainText,
    countUndecided,
    escapeHtmlText,
    parseSerialisedDocument
} from "../export";
import { useV2Store } from "../state/useV2Store";

type ExportFormat = "md" | "txt" | "html";

const FORMATS: Array<{ format: ExportFormat; label: string }> = [
    { format: "md", label: "Markdown" },
    { format: "txt", label: "Text" },
    { format: "html", label: "HTML" }
];

const RENDERERS: Record<ExportFormat, (chapters: Array<{ title: string; content: string }>) => string> = {
    md: chapters =>
        chapters.map(c => `# ${c.title}\n\n${blocksToMarkdown(parseSerialisedDocument(c.content))}`).join("\n\n"),
    txt: chapters =>
        chapters.map(c => `${c.title}\n\n${blocksToPlainText(parseSerialisedDocument(c.content))}`).join("\n\n\n"),
    html: chapters =>
        chapters
            .map(c => `<h1>${escapeHtmlText(c.title)}</h1>\n${blocksToHtml(parseSerialisedDocument(c.content))}`)
            .join("\n")
};

const MIME: Record<ExportFormat, string> = { md: "text/markdown", txt: "text/plain", html: "text/html" };

/** Whole-story export through the v2 converters (headings actually work). */
export const ExportButtons = ({ storyId }: { storyId: string }) => {
    const { lastChapterFor } = useV2Store();
    // Undecided takes and ghost suggestions are visible on screen but omitted
    // from every export — the writer must choose, not discover the hole later
    const confirmUndecided = (chapters: Array<{ content: string }>): boolean => {
        const undecided = chapters.reduce((sum, c) => sum + countUndecided(c.content), 0);
        return (
            undecided === 0 ||
            window.confirm(
                `${undecided} unaccepted AI draft${undecided === 1 ? "" : "s"} (scene-beat takes or pending suggestions) won't be included. Export anyway?`
            )
        );
    };

    const exportAs = async (format: ExportFormat) => {
        const [error, result] = await attemptPromise(async () => {
            // The book must contain the last keystrokes, not race the debounce
            const openChapter = lastChapterFor(storyId);
            if (openChapter) await flushChapterSave(openChapter);
            const [story, chapters] = await Promise.all([storiesApi.getById(storyId), chaptersApi.getByStory(storyId)]);
            const ordered = [...chapters].sort((a, b) => a.order - b.order);
            if (!confirmUndecided(ordered)) return null;
            return { story, body: RENDERERS[format](ordered) };
        });
        if (error) {
            toast.error("Export failed — a chapter may not be v2 format");
            return;
        }
        if (!result) return;
        const blob = new Blob([result.body], { type: `${MIME[format]};charset=utf-8` });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `${result.story.title.replace(/[^\w-]+/g, "-")}.${format}`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    return (
        <section className="border-t px-4 py-3">
            <h2 className="mb-2 flex items-center gap-2 font-medium">
                <Download className="h-4 w-4 text-muted-foreground" /> Export story
            </h2>
            <div className="flex flex-wrap gap-2">
                {FORMATS.map(({ format, label }) => (
                    <button
                        key={format}
                        type="button"
                        onClick={() => void exportAs(format)}
                        className="rounded-md border px-3 py-1.5 text-sm"
                    >
                        {label}
                    </button>
                ))}
                <a href={`/api/stories/${storyId}/epub`} download className="rounded-md border px-3 py-1.5 text-sm">
                    EPUB
                </a>
                <a
                    href={`/api/stories/${storyId}/export`}
                    download
                    title="Full story data: chapters, bible, notes, chats, AI overrides — re-importable"
                    className="rounded-md border px-3 py-1.5 text-sm"
                >
                    JSON (backup)
                </a>
            </div>
        </section>
    );
};
