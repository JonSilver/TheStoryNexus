import { chaptersApi, storiesApi } from "@/services/api/client";
import { extractPlainTextFromLexical } from "../lexicalUtils";
import { convertLexicalToHtml } from "./convertLexicalToHtml";
import { convertLexicalToMarkdown } from "./convertLexicalToMarkdown";
import { downloadAsFile } from "./downloadAsFile";
import { exportStoryAsEpub } from "./exportStoryAsEpub";
import { exportStoryAsPdf } from "./exportStoryAsPdf";
import { type ExportFormat } from "./types";

/**
 * Downloads a chapter in specified format
 * @param chapterId The ID of the chapter to download
 * @param format The format to download
 */

export async function downloadChapter(chapterId: string, format: ExportFormat) {
    const chapter = await chaptersApi.getById(chapterId);
    if (!chapter) throw new Error("Chapter not found");

    const story = await storiesApi.getById(chapter.storyId);
    if (!story) throw new Error("Story not found");

    const filename = `${story.title} - Chapter ${chapter.order}`;

    switch (format) {
        case "html": {
            const chapterHtml = await convertLexicalToHtml(chapter.content);
            const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${story.title} - Chapter ${chapter.order}: ${chapter.title}</title>
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
  <div class="chapter">
    <h2 class="chapter-title">Chapter ${chapter.order}: ${chapter.title}</h2>
    <div class="chapter-content">${chapterHtml}</div>
  </div>
</body>
</html>`;

            downloadAsFile(htmlContent, `${filename}.html`, "text/html");
            break;
        }

        case "text": {
            const chapterPlainText = extractPlainTextFromLexical(chapter.content, {
                paragraphSpacing: "\n\n"
            });
            const textContent = `${story.title}\nChapter ${chapter.order}: ${chapter.title}\n\n${chapterPlainText.trim()}`;
            downloadAsFile(textContent, `${filename}.txt`, "text/plain");
            break;
        }

        case "markdown": {
            const chapterMarkdown = convertLexicalToMarkdown(chapter.content);
            const markdownContent = `# ${story.title}\n\n## Chapter ${chapter.order}: ${chapter.title}\n\n${chapterMarkdown}`;
            downloadAsFile(markdownContent, `${filename}.md`, "text/markdown");
            break;
        }

        case "epub":
            await exportStoryAsEpub(story);
            break;

        case "pdf":
            await exportStoryAsPdf(story, [chapter]);
            break;
    }
}
