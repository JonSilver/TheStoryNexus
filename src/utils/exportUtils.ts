import { chaptersApi, storiesApi } from "@/services/api/client";
import type { Chapter, Story } from "@/types/story";
import { extractPlainTextFromLexical } from "./lexicalUtils";

interface SerializedLexicalNode {
    type: string;
    text?: string;
    children?: SerializedLexicalNode[];
    tag?: string;
    version?: number;
    format?: number;
}

interface LexicalEditorState {
    root?: {
        children?: SerializedLexicalNode[];
    };
}

type ExportFormat = "html" | "text" | "markdown" | "epub" | "pdf";

/**
 * Converts Lexical JSON content to HTML
 * @param jsonContent The Lexical JSON content string
 * @returns HTML string representation of the content
 */
async function convertLexicalToHtml(jsonContent: string): Promise<string> {
    const editorState: LexicalEditorState = JSON.parse(jsonContent);
    const container = document.createElement("div");

    const processNode = (node: SerializedLexicalNode, parentElement: HTMLElement): void => {
        if (node.type === "text" && node.text) {
            const textNode = document.createTextNode(node.text);
            parentElement.appendChild(textNode);
        } else if (node.type === "paragraph") {
            const p = document.createElement("p");
            if (node.children) {
                node.children.forEach(child => processNode(child, p));
            }
            parentElement.appendChild(p);
        } else if (node.type === "heading" && node.tag) {
            const headingTag = `h${node.tag}`;
            const heading = document.createElement(headingTag);
            if (node.children) {
                node.children.forEach(child => processNode(child, heading));
            }
            parentElement.appendChild(heading);
        } else if (node.children) {
            node.children.forEach(child => processNode(child, parentElement));
        }
    };

    if (editorState.root?.children) {
        editorState.root.children.forEach(node => processNode(node, container));
    }

    return container.innerHTML;
}

/**
 * Downloads content as a file
 * @param content The content to download
 * @param filename The name of the file
 * @param contentType The MIME type of the content
 */
function downloadAsFile(content: string | Blob, filename: string, contentType: string) {
    const blob = content instanceof Blob ? content : new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
}

/**
 * Converts Lexical JSON content to Markdown
 * @param jsonContent The Lexical JSON content string
 * @returns Markdown string representation of the content
 */
function convertLexicalToMarkdown(jsonContent: string): string {
    const editorState: LexicalEditorState = JSON.parse(jsonContent);
    const lines: string[] = [];

    const processNode = (node: SerializedLexicalNode): string => {
        if (node.type === "text" && node.text) {
            const text = node.text;
            if (node.format) {
                const isBold = (node.format & 1) !== 0;
                const isItalic = (node.format & 2) !== 0;
                const isUnderline = (node.format & 8) !== 0;
                const isCode = (node.format & 16) !== 0;

                if (isCode) return `\`${text}\``;
                let formatted = text;
                if (isBold) formatted = `**${formatted}**`;
                if (isItalic) formatted = `_${formatted}_`;
                if (isUnderline) formatted = `<u>${formatted}</u>`;
                return formatted;
            }
            return text;
        } else if (node.type === "linebreak") {
            return "  \n";
        } else if (node.type === "paragraph") {
            const childrenText = node.children ? node.children.map(processNode).join("") : "";
            return `${childrenText}\n\n`;
        } else if (node.type === "heading" && node.tag) {
            const level = parseInt(node.tag, 10);
            const prefix = "#".repeat(level);
            const childrenText = node.children ? node.children.map(processNode).join("") : "";
            return `${prefix} ${childrenText}\n\n`;
        } else if (node.children) {
            return node.children.map(processNode).join("");
        }
        return "";
    };

    if (editorState.root?.children) {
        editorState.root.children.forEach(node => {
            const text = processNode(node);
            if (text) lines.push(text);
        });
    }

    return lines.join("").trim();
}

/**
 * Exports story to EPUB format (server-generated)
 */
async function exportStoryAsEpub(story: Story): Promise<void> {
    const response = await fetch(`/api/stories/${story.id}/epub`);
    if (!response.ok) throw new Error("Failed to generate EPUB");

    const blob = await response.blob();
    downloadAsFile(blob, `${story.title}.epub`, "application/epub+zip");
}

/**
 * Exports story to PDF format (lazy-loaded)
 */
async function exportStoryAsPdf(story: Story, chapters: Chapter[]): Promise<void> {
    const { jsPDF } = await import("jspdf");

    // biome-ignore lint/suspicious/noExplicitAny: jsPDF types are incomplete
    const doc = new jsPDF() as any;

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const headerMargin = 15;
    const footerMargin = 15;
    const maxLineWidth = pageWidth - margin * 2;
    let yPos = margin;
    let currentChapter = "";

    const addHeaderFooter = (pageNum: number, isContentPage: boolean) => {
        if (!isContentPage) return; // Skip header/footer on cover page

        // Header - story title and chapter
        doc.setFontSize(9);
        doc.setFont("helvetica", "italic");
        doc.text(story.title, margin, headerMargin, { align: "left" });
        if (currentChapter) {
            doc.text(currentChapter, pageWidth - margin, headerMargin, { align: "right" });
        }

        // Footer - author and page number
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(story.author, margin, pageHeight - footerMargin, { align: "left" });
        doc.text(`${pageNum}`, pageWidth - margin, pageHeight - footerMargin, { align: "right" });

        // Header line
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(margin, headerMargin + 2, pageWidth - margin, headerMargin + 2);
    };

    const addText = (
        text: string,
        fontSize: number,
        isBold = false,
        isItalic = false,
        align: "left" | "center" = "left",
        isContentPage = true
    ) => {
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : isItalic ? "italic" : "normal");

        const lines = doc.splitTextToSize(text, maxLineWidth);
        const contentStart = isContentPage ? headerMargin + 10 : margin;
        const contentEnd = isContentPage ? pageHeight - footerMargin - 10 : pageHeight - margin;

        lines.forEach((line: string) => {
            if (yPos + fontSize / 2 > contentEnd) {
                const pageNum = doc.internal.getNumberOfPages();
                addHeaderFooter(pageNum, isContentPage);
                doc.addPage();
                yPos = contentStart;
            }

            const xPos = align === "center" ? pageWidth / 2 : margin;
            doc.text(line, xPos, yPos, { align });
            yPos += fontSize / 2 + 2;
        });
    };

    const addSpace = (space: number, isContentPage = true) => {
        const contentEnd = isContentPage ? pageHeight - footerMargin - 10 : pageHeight - margin;
        yPos += space;
        if (yPos > contentEnd) {
            const pageNum = doc.internal.getNumberOfPages();
            addHeaderFooter(pageNum, isContentPage);
            doc.addPage();
            yPos = isContentPage ? headerMargin + 10 : margin;
        }
    };

    // Cover page
    yPos = pageHeight / 3;
    addText(story.title, 28, true, false, "center", false);
    addSpace(10, false);
    addText(`by ${story.author}`, 16, false, true, "center", false);

    // Start content on new page
    doc.addPage();
    yPos = headerMargin + 10;

    // Synopsis (if exists)
    if (story.synopsis) {
        currentChapter = "Synopsis";
        addText("Synopsis", 16, true);
        addSpace(8);
        addText(story.synopsis, 12);
        addSpace(20);
    }

    // Chapters
    chapters.forEach((chapter, idx) => {
        if (idx > 0 || story.synopsis) {
            const pageNum = doc.internal.getNumberOfPages();
            addHeaderFooter(pageNum, true);
            doc.addPage();
            yPos = headerMargin + 10;
        }

        currentChapter = `Chapter ${chapter.order}`;
        addText(`Chapter ${chapter.order}: ${chapter.title}`, 18, true);
        addSpace(10);

        const chapterText = extractPlainTextFromLexical(chapter.content, { paragraphSpacing: "\n\n" });
        const paragraphs = chapterText.split("\n\n").filter(p => p.trim());

        paragraphs.forEach(para => {
            addText(para, 12);
            addSpace(5);
        });
    });

    // Add header/footer to last page
    const finalPageNum = doc.internal.getNumberOfPages();
    addHeaderFooter(finalPageNum, true);

    doc.save(`${story.title}.pdf`);
}

/**
 * Downloads a story in specified format
 * @param storyId The ID of the story to download
 * @param format The format to download
 */
export async function downloadStory(storyId: string, format: ExportFormat) {
    const story = await storiesApi.getById(storyId);
    if (!story) {
        throw new Error("Story not found");
    }

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

/**
 * Downloads a chapter in specified format
 * @param chapterId The ID of the chapter to download
 * @param format The format to download
 */
export async function downloadChapter(chapterId: string, format: ExportFormat) {
    const chapter = await chaptersApi.getById(chapterId);
    if (!chapter) {
        throw new Error("Chapter not found");
    }

    const story = await storiesApi.getById(chapter.storyId);
    if (!story) {
        throw new Error("Story not found");
    }

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
