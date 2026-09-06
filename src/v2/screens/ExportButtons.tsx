import { attemptPromise } from "@jfdi/attempt";
import { Download } from "lucide-react";
import { toast } from "react-toastify";
import { chaptersApi, storiesApi } from "@/services/api/client";
import { blocksToHtml, blocksToMarkdown, blocksToPlainText, escapeHtmlText, parseSerialisedDocument } from "../export";

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
    const exportAs = async (format: ExportFormat) => {
        const [error, result] = await attemptPromise(async () => {
            const [story, chapters] = await Promise.all([storiesApi.getById(storyId), chaptersApi.getByStory(storyId)]);
            const ordered = [...chapters].sort((a, b) => a.order - b.order);
            return { story, body: RENDERERS[format](ordered) };
        });
        if (error || !result) {
            toast.error("Export failed — a chapter may not be v2 format");
            return;
        }
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
            </div>
        </section>
    );
};
