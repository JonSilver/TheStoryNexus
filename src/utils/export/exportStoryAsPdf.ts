import type { Chapter, Story } from "@/types/story";
import { extractPlainTextFromLexical } from "../lexicalUtils";

/**
 * Exports story to PDF format (lazy-loaded)
 */
export async function exportStoryAsPdf(story: Story, chapters: Chapter[]): Promise<void> {
    const { jsPDF } = await import("jspdf");

    // eslint-disable-next-line typescript-eslint/no-explicit-any -- jsPDF types are incomplete
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
        if (currentChapter) doc.text(currentChapter, pageWidth - margin, headerMargin, { align: "right" });

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
