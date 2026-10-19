import { describe, expect, it } from "vitest";
import { detectHeadings, splitIntoChapters } from "./split.js";

const paragraph = (words: number, seed = "word") =>
    Array.from({ length: words }, (_, index) => `${seed}${index}`).join(" ");

/** Bodies long enough to clear the plausibility guards that protect the weaker patterns. */
const body = (seed: string) => `${paragraph(400, seed)}\n\n${paragraph(400, `${seed}b`)}`;

describe("splitIntoChapters — markdown headings", () => {
    it("splits on # and ## headings, taking the heading text as the title", () => {
        const chapters = splitIntoChapters(`# The Gate\n\nOpening prose.\n\n## Arrival\n\nMore prose.`);
        expect(chapters).toEqual([
            { title: "The Gate", body: "Opening prose." },
            { title: "Arrival", body: "More prose." }
        ]);
    });

    it("clamps deeper headings and strips closed-atx hashes", () => {
        const chapters = splitIntoChapters(`#### Deep ####\n\nBody.`);
        expect(chapters).toEqual([{ title: "Deep", body: "Body." }]);
    });

    it("keeps text before the first heading as front matter rather than dropping it", () => {
        const chapters = splitIntoChapters(`A dedication.\n\n# One\n\nProse.`);
        expect(chapters.map(chapter => chapter.title)).toEqual(["Front Matter", "One"]);
        expect(chapters[0].body).toBe("A dedication.");
    });

    it("prefers markdown headings over prose patterns when both are present", () => {
        const chapters = splitIntoChapters(`## Part One\n\nChapter 3 was a difficult year.\n\n## Part Two\n\nEnd.`);
        expect(chapters.map(chapter => chapter.title)).toEqual(["Part One", "Part Two"]);
        expect(chapters[0].body).toBe("Chapter 3 was a difficult year.");
    });

    it("drops headings with no body beneath them", () => {
        const chapters = splitIntoChapters(`# Book One\n## Chapter One\n\nProse.`);
        expect(chapters).toEqual([{ title: "Chapter One", body: "Prose." }]);
    });
});

describe("splitIntoChapters — prose chapter patterns", () => {
    it.each([
        ["Chapter 1", "Chapter 1"],
        ["CHAPTER 12", "CHAPTER 12"],
        ["Chapter One", "Chapter One"],
        ["Chapter Twenty-One", "Chapter Twenty-One"],
        ["Chapter IV", "Chapter IV"],
        ["Chapter 2: The Reckoning", "Chapter 2: The Reckoning"],
        ["Chapter Three — Ashes", "Chapter Three — Ashes"],
        ["Prologue", "Prologue"],
        ["EPILOGUE", "EPILOGUE"],
        ["Interlude: the long night", "Interlude: the long night"],
        ["Part II", "Part II"],
        ["Book Two", "Book Two"]
    ])("treats %s as a chapter opening", (heading, expected) => {
        const chapters = splitIntoChapters(`${heading}\n\n${body("a")}\n\nChapter 99\n\n${body("b")}`);
        expect(chapters[0].title).toBe(expected);
        expect(chapters).toHaveLength(2);
    });

    it("trims a trailing colon from the title", () => {
        const chapters = splitIntoChapters(`Prologue:\n\n${body("a")}`);
        expect(chapters[0].title).toBe("Prologue");
    });

    it("ignores chapter words that merely start a sentence", () => {
        const text = `Chapter and verse, he said, was not the point of the exercise at all.\n\n${body("a")}`;
        expect(splitIntoChapters(text)).toHaveLength(1);
        expect(splitIntoChapters(text)[0].title).toBe("Chapter 1");
    });

    it("ignores heading-like lines that are too long to be headings", () => {
        const chapters = splitIntoChapters(`Prologue ${paragraph(40, "x")}\n\n${body("a")}`);
        expect(chapters).toHaveLength(1);
    });
});

describe("splitIntoChapters — numeric and roman-only headings", () => {
    it("splits on bare numbers when the sections are chapter-sized", () => {
        const chapters = splitIntoChapters(`1\n\n${body("a")}\n\n2\n\n${body("b")}`);
        expect(chapters.map(chapter => chapter.title)).toEqual(["1", "2"]);
    });

    it("splits on upper-case roman numerals", () => {
        const chapters = splitIntoChapters(`I.\n\n${body("a")}\n\nII.\n\n${body("b")}`);
        expect(chapters.map(chapter => chapter.title)).toEqual(["I.", "II."]);
    });

    it("does not treat lower-case roman-shaped words as headings", () => {
        expect(detectHeadings("did\nmild\ncivil")).toEqual([]);
    });

    it("ignores page numbers scattered through a stripped PDF", () => {
        const page = (n: number) => `${paragraph(60, `p${n}`)}\n\n${n}\n`;
        const chapters = splitIntoChapters(Array.from({ length: 12 }, (_, index) => page(index + 1)).join("\n"));
        expect(chapters).toHaveLength(1);
    });

    it("prefers real chapter headings over interleaved page numbers", () => {
        const page = (n: number) => `${paragraph(60, `p${n}`)}\n\n${n}\n`;
        const pages = (from: number) => Array.from({ length: 5 }, (_, index) => page(from + index)).join("\n");
        const chapters = splitIntoChapters(`Chapter One\n\n${pages(1)}\n\nChapter Two\n\n${pages(6)}`);
        expect(chapters.map(chapter => chapter.title)).toEqual(["Chapter One", "Chapter Two"]);
    });
});

describe("splitIntoChapters — separators", () => {
    it("splits on scene separators when they carve out chapter-sized pieces", () => {
        const chapters = splitIntoChapters(`${paragraph(1500, "a")}\n\n* * *\n\n${paragraph(1500, "b")}`);
        expect(chapters).toHaveLength(2);
        expect(chapters.map(chapter => chapter.title)).toEqual(["Chapter 1", "Chapter 2"]);
        expect(chapters[0].body).not.toContain("*");
    });

    it("leaves scene-sized separator chunks alone", () => {
        const chapters = splitIntoChapters(`${paragraph(200, "a")}\n\n---\n\n${paragraph(200, "b")}`);
        expect(chapters).toHaveLength(1);
        expect(chapters[0].body).toContain("---");
    });
});

describe("splitIntoChapters — fallbacks", () => {
    it("returns a single chapter when no pattern matches", () => {
        const chapters = splitIntoChapters(`${paragraph(50, "a")}\n\n${paragraph(50, "b")}`);
        expect(chapters).toHaveLength(1);
        expect(chapters[0].title).toBe("Chapter 1");
    });

    it("chunks very long unstructured text into several chapters", () => {
        const text = Array.from({ length: 40 }, (_, index) => paragraph(1000, `p${index}`)).join("\n\n");
        const chapters = splitIntoChapters(text);
        expect(chapters.length).toBeGreaterThan(5);
        expect(chapters.map(chapter => chapter.title)).toEqual(chapters.map((_, index) => `Chapter ${index + 1}`));
        expect(chapters.every(chapter => chapter.body.trim().length > 0)).toBe(true);
    });

    it("loses no words when chunking by length", () => {
        const paragraphs = Array.from({ length: 40 }, (_, index) => paragraph(1000, `p${index}`));
        const chapters = splitIntoChapters(paragraphs.join("\n\n"));
        expect(chapters.flatMap(chapter => chapter.body.split(/\s+/)).length).toBe(40 * 1000);
    });

    it("returns nothing for empty or whitespace-only input", () => {
        expect(splitIntoChapters("")).toEqual([]);
        expect(splitIntoChapters("   \n\n \t ")).toEqual([]);
    });
});

describe("splitIntoChapters — general invariants", () => {
    it("normalises CRLF line endings", () => {
        expect(splitIntoChapters("# One\r\n\r\nProse.\r\n")).toEqual([{ title: "One", body: "Prose." }]);
    });

    it("trims bodies and never emits an empty title", () => {
        const chapters = splitIntoChapters(`#  \n\nProse.\n\n# Named\n\nMore.`);
        expect(chapters.every(chapter => chapter.title.length > 0)).toBe(true);
        expect(chapters.every(chapter => chapter.body === chapter.body.trim())).toBe(true);
    });
});
