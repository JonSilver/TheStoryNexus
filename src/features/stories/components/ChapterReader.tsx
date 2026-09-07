import { useMemo } from "react";
import type { Chapter } from "@/types/story";
import { blocksToHtml, parseSerialisedDocument } from "@/v2/export";

interface ChapterReaderProps {
    chapter: Chapter;
    chapterNumber: number;
}

/**
 * Renders a chapter through the v2 export pipeline rather than a Lexical
 * instance: a live editor cannot parse documents containing node types it
 * doesn't register (v2 scene beats, ghost suggestions, v2 images), and
 * showed an EMPTY chapter instead of the manuscript. The converter escapes
 * all text, omits writing machinery, and falls back to inline children for
 * unknown block types — every chapter renders as readable prose.
 */
export function ChapterReader({ chapter, chapterNumber }: ChapterReaderProps) {
    const html = useMemo(() => {
        if (!chapter.content) return "";
        try {
            return blocksToHtml(parseSerialisedDocument(chapter.content));
        } catch {
            return "<p><em>This chapter could not be rendered.</em></p>";
        }
    }, [chapter.content]);

    return (
        <article className="chapter-reader">
            <div className="mb-6 border-b pb-4">
                {!/^chapter\b/i.test(chapter.title.trim()) && (
                    <h2 className="mb-1 text-xl font-semibold uppercase tracking-wide text-muted-foreground">
                        Chapter {chapterNumber}
                    </h2>
                )}
                <h3 className="text-3xl font-bold">{chapter.title}</h3>
            </div>
            <div
                className="prose prose-neutral max-w-none text-base leading-relaxed dark:prose-invert"
                // Safe: html is produced by our own converter, which escapes all
                // text content and restricts image sources to /api/assets/
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </article>
    );
}
