import { describe, expect, it } from "vitest";
import { type Block, parseSerialisedDocument } from "../../../src/v2/export/blocks.js";
import { blocksToPlainText } from "../../../src/v2/export/toPlainText.js";
import { splitIntoChapters } from "./split.js";
import { toLexicalDocument } from "./toLexical.js";

const blocksOf = (body: string): Block[] => parseSerialisedDocument(toLexicalDocument(body));

const roundTrip = (body: string): string => blocksToPlainText(blocksOf(body));

describe("toLexicalDocument — document shape", () => {
    it("produces a root the export module accepts", () => {
        const document = JSON.parse(toLexicalDocument("Hello."));
        expect(document.root).toMatchObject({ type: "root", version: 1, format: "", indent: 0, direction: null });
        expect(document.root.children).toHaveLength(1);
    });

    it("emits paragraphs with the inline text shape the editor writes", () => {
        const [child] = JSON.parse(toLexicalDocument("Hello.")).root.children;
        expect(child).toMatchObject({ type: "paragraph", version: 1, format: "", indent: 0, direction: null });
        expect(child.children[0]).toEqual({
            detail: 0,
            format: 0,
            mode: "normal",
            style: "",
            text: "Hello.",
            type: "text",
            version: 1
        });
    });

    it("gives an empty body a single empty paragraph rather than an empty root", () => {
        const { root } = JSON.parse(toLexicalDocument(""));
        expect(root.children).toEqual([expect.objectContaining({ type: "paragraph", children: [] })]);
    });

    it("splits paragraphs on blank lines", () => {
        expect(blocksOf("One.\n\nTwo.\n\n\nThree.")).toEqual([
            { type: "paragraph", content: [{ type: "text", text: "One.", marks: [] }] },
            { type: "paragraph", content: [{ type: "text", text: "Two.", marks: [] }] },
            { type: "paragraph", content: [{ type: "text", text: "Three.", marks: [] }] }
        ]);
    });

    it("keeps consecutive lines inside one paragraph as line breaks", () => {
        expect(blocksOf("First line\nSecond line")).toEqual([
            {
                type: "paragraph",
                content: [
                    { type: "text", text: "First line", marks: [] },
                    { type: "lineBreak" },
                    { type: "text", text: "Second line", marks: [] }
                ]
            }
        ]);
    });

    it("maps # ## ### to h1 h2 h3 and clamps deeper levels", () => {
        const levels = blocksOf("# One\n\n## Two\n\n### Three\n\n##### Five").map(block =>
            block.type === "heading" ? block.level : null
        );
        expect(levels).toEqual([1, 2, 3, 3]);
    });

    it("ends the paragraph in progress when a heading interrupts it", () => {
        expect(blocksOf("Prose.\n# Heading\nMore prose.").map(block => block.type)).toEqual([
            "paragraph",
            "heading",
            "paragraph"
        ]);
    });

    it("turns separator-only lines into horizontal rules", () => {
        expect(blocksOf("A.\n\n---\n\nB.\n\n***\n\nC.\n\n___").map(block => block.type)).toEqual([
            "paragraph",
            "horizontalRule",
            "paragraph",
            "horizontalRule",
            "paragraph",
            "horizontalRule"
        ]);
    });

    it("leaves inline markdown as literal text", () => {
        expect(blocksOf("**bold** and *star*")).toEqual([
            { type: "paragraph", content: [{ type: "text", text: "**bold** and *star*", marks: [] }] }
        ]);
    });
});

describe("toLexicalDocument — round trip through the export module", () => {
    it.each([
        ["a single paragraph", "Just one line of prose."],
        ["several paragraphs", "One.\n\nTwo.\n\nThree."],
        ["a hard-wrapped paragraph", "The gate stood open,\nand nobody had thought to close it."],
        ["punctuation and quotes", 'He said "don\'t" — a_b, [bracket], `tick`, back\\slash and issue #5 at 5am.'],
        ["unicode", "Zoë walked to the café; naïve résumé — 大丈夫."]
    ])("preserves %s", (_label, text) => {
        expect(roundTrip(text)).toBe(text);
    });

    it("keeps heading prose, without its markdown markers", () => {
        expect(roundTrip("# The Keep\n\nProse beneath.\n\n## Aftermath\n\nMore prose.")).toBe(
            "The Keep\n\nProse beneath.\n\nAftermath\n\nMore prose."
        );
    });

    it("normalises runs of blank lines to a single paragraph break", () => {
        expect(roundTrip("One.\n\n\n\nTwo.")).toBe("One.\n\nTwo.");
    });

    it("drops horizontal rules, which carry no prose", () => {
        expect(roundTrip("Before.\n\n---\n\nAfter.")).toBe("Before.\n\nAfter.");
    });

    it("round-trips every chapter of a split manuscript", () => {
        const manuscript = [
            "# Chapter One",
            "",
            "The gate stood open.",
            "Nobody had closed it.",
            "",
            "She went in anyway.",
            "",
            "## Chapter Two",
            "",
            "The steward was lying.",
            ""
        ].join("\n");

        splitIntoChapters(manuscript).forEach(chapter => expect(roundTrip(chapter.body)).toBe(chapter.body));
    });
});
