import { attempt } from "@jfdi/attempt";
import type { InferSelectModel } from "drizzle-orm";
import epubModule from "epub-gen-memory";
import { parseSerialisedDocument } from "../../src/v2/export/blocks.js";
import { blocksToHtml, escapeHtmlText } from "../../src/v2/export/toHtml.js";
import type { schema } from "../db/client.js";

const epub = epubModule.default || epubModule;

type Story = InferSelectModel<typeof schema.stories>;
type Chapter = InferSelectModel<typeof schema.chapters>;

// v2 canonical converter: correct headings/lists/marks, fully escaped output.
// epub-gen-memory downloads images to embed them and only accepts absolute
// URLs, so relative asset paths are pointed back at this server.
const convertLexicalToHtml = (jsonContent: string, chapterTitle: string): string => {
    const [error, html] = attempt(() => blocksToHtml(parseSerialisedDocument(jsonContent)));
    // Silently exporting an empty chapter would discard prose without a trace
    if (error || html === undefined)
        throw new Error(`Chapter "${chapterTitle}" could not be converted: ${error?.message}`);
    const port = process.env.PORT || 3000;
    return html.split('src="/api/assets/').join(`src="http://127.0.0.1:${port}/api/assets/`);
};

/**
 * Generates an EPUB file from story and chapters
 */
export const generateEpub = async (story: Story, chapters: Chapter[]): Promise<Buffer> => {
    const chapterHtmls = chapters.map(chapter => convertLexicalToHtml(chapter.content, chapter.title));

    const epubChapters = [
        {
            title: "",
            content: `
                <div class="cover-page">
                    <h1 class="cover-title">${escapeHtmlText(story.title)}</h1>
                    <p class="cover-author">by ${escapeHtmlText(story.author)}</p>
                    ${story.synopsis ? `<div class="cover-synopsis"><p><strong>Synopsis</strong></p><p>${escapeHtmlText(story.synopsis)}</p></div>` : ""}
                </div>
            `,
            excludeFromToc: true,
            beforeToc: true
        },
        ...chapters.map((chapter, idx) => ({
            title: `Chapter ${chapter.order}: ${chapter.title}`,
            content: chapterHtmls[idx]
        }))
    ];

    const css = `
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
            line-height: 1.6;
            margin: 1em;
        }
        .cover-page {
            text-align: center;
            padding-top: 0;
            page-break-after: always;
        }
        .cover-title {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 0.5em;
        }
        .cover-author {
            font-size: 1.5em;
            font-style: italic;
            margin-bottom: 2em;
        }
        .cover-synopsis {
            margin-top: 3em;
            text-align: left;
            max-width: 80%;
            margin-left: auto;
            margin-right: auto;
        }
        .chapter {
            page-break-before: always;
        }
        .chapter-title {
            font-size: 1.5em;
            font-weight: bold;
            margin-top: 2em;
            margin-bottom: 1em;
            text-align: center;
        }
        .chapter-content {
            text-align: justify;
        }
        p {
            margin: 1em 0;
            text-indent: 1.5em;
        }
        p:first-child {
            text-indent: 0;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
            font-weight: bold;
        }
    `;

    const options = {
        title: story.title,
        author: story.author,
        ...(story.synopsis && { description: story.synopsis }),
        lang: story.language || "en",
        css
    };

    return await epub(options, epubChapters);
};
