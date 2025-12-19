import { chaptersApi, storiesApi } from "@/services/api/client";
import { extractPlainTextFromLexical } from "../lexicalUtils";
import { convertLexicalToHtml } from "./convertLexicalToHtml";
import { convertLexicalToMarkdown } from "./convertLexicalToMarkdown";
import { downloadAsFile } from "./downloadAsFile";
import { exportStoryAsEpub } from "./exportStoryAsEpub";
import { exportStoryAsPdf } from "./exportStoryAsPdf";
import { type ExportFormat } from "./types";

/**
 * Downloads a story in specified format
 * @param storyId The ID of the story to download
 * @param format The format to download
 */

export async function downloadStory(storyId: string, format: ExportFormat) {
    const story = await storiesApi.getById(storyId);
    if (!story) throw new Error("Story not found");

    const chaptersUnsorted = await chaptersApi.getByStory(storyId);
    const chapters = chaptersUnsorted.sort((a, b) => a.order - b.order);

    switch (format) {
        case "html": {
            const chapterHtmlParts = await Promise.all(
                chapters.map(async chapter => {
                    const chapterHtml = await convertLexicalToHtml(chapter.content);
                    return `<div class="chapter">
    <h2 class="chapter-title">Chapter ${chapter.order}: ${chapter.title}</h2>
    <div class="chapter-content">${chapterHtml}</div>
  </div>`;
                })
            );

            const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${story.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; }
    h2 { margin-top: 40px; }
    .chapter { margin-bottom: 30px; }
    .chapter-title { font-size: 24px; margin-bottom: 10px; }
    .meta { color: #666; margin-bottom: 20px; }
  </style>
</head>
<body>
  <h1>${story.title}</h1>
  <div class="meta">
    <p>Author: ${story.author}</p>
    ${story.synopsis ? `<p>Synopsis: ${story.synopsis}</p>` : ""}
  </div>
  ${chapterHtmlParts.join("\n")}
</body>
</html>`;

            downloadAsFile(htmlContent, `${story.title}.html`, "text/html");
            break;
        }

        case "text": {
            const chapterTextParts = chapters.map(chapter => {
                const chapterPlainText = extractPlainTextFromLexical(chapter.content, {
                    paragraphSpacing: "\n\n"
                });
                return `Chapter ${chapter.order}: ${chapter.title}\n\n${chapterPlainText.trim()}`;
            });

            const synopsisPart = story.synopsis ? `Synopsis: ${story.synopsis}\n` : "";
            const headerPart = `${story.title}\nAuthor: ${story.author}\n${synopsisPart}\n\n`;
            const textContent = headerPart + chapterTextParts.join("\n\n");

            downloadAsFile(textContent, `${story.title}.txt`, "text/plain");
            break;
        }

        case "markdown": {
            const chapterMarkdownParts = chapters.map(chapter => {
                const chapterMarkdown = convertLexicalToMarkdown(chapter.content);
                return `## Chapter ${chapter.order}: ${chapter.title}\n\n${chapterMarkdown}`;
            });

            const synopsisPart = story.synopsis ? `**Synopsis:** ${story.synopsis}\n\n` : "";
            const headerPart = `# ${story.title}\n\n**Author:** ${story.author}\n\n${synopsisPart}---\n\n`;
            const markdownContent = headerPart + chapterMarkdownParts.join("\n\n---\n\n");

            downloadAsFile(markdownContent, `${story.title}.md`, "text/markdown");
            break;
        }

        case "epub":
            await exportStoryAsEpub(story);
            break;

        case "pdf":
            await exportStoryAsPdf(story, chapters);
            break;
    }
}
