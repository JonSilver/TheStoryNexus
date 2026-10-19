import { describe, expect, it } from "vitest";
import { parseEditorState, parseSerialisedDocument } from "./blocks.js";
import { emptyDocumentState, kitchenSinkJson, sceneBeatOnlyState } from "./fixtures.js";
import { blocksToMarkdown } from "./toMarkdown.js";

const markdown = blocksToMarkdown(parseSerialisedDocument(kitchenSinkJson));

const render = (children: Record<string, unknown>[]) =>
    blocksToMarkdown(parseEditorState({ root: { type: "root", children } }));

const textNode = (text: string, format = 0) => ({ type: "text", text, format });

// Lines rather than a template literal: the hard-break marker carries trailing spaces.
const EXPECTED = [
    "# The Iron Keep",
    "",
    "## Chapter **Two**",
    "",
    "### Aftermath",
    "",
    "### Too Deep",
    "",
    "plain **bold** *italic* <u>underline</u> ***bold italic*** **<u>bold underline</u>** *<u>italic underline</u>* ***<u>all three</u>***",
    "",
    'He said "don\'t" — a\\_b, \\*star\\*, \\[bracket\\], \\`tick\\`, back\\\\slash and issue #5.',
    "",
    "\\#hashtag opens the line",
    "",
    "First line  ",
    "second line",
    "",
    "Before\tafter",
    "",
    "linked *prose*",
    "",
    "- Alpha",
    "    - Alpha nested",
    "- Beta **bold**",
    "",
    "1. First",
    "    1. Nested one",
    "    2. Nested two",
    "2. Second",
    "",
    "3. Third",
    "4. Fourth",
    "",
    "---",
    "",
    "![A keep at dusk](/api/assets/s1/keep.png)",
    "",
    '![Ash & <Mara>](</api/assets/s1/ash (2).png> "Ash & Mara at the \\"gate\\"")',
    "",
    "An unknown block keeps its **prose**",
    "",
    "Nested unknown prose"
].join("\n");

describe("blocksToMarkdown", () => {
    it("renders the whole fixture document exactly", () => {
        expect(markdown).toBe(EXPECTED);
    });

    it("renders headings as hashes, not the h-tag string", () => {
        const headings = ["h1", "h2", "h3", "h4"].map(tag =>
            render([{ type: "heading", tag, children: [textNode("Title")] }])
        );
        expect(headings).toEqual(["# Title", "## Title", "### Title", "### Title"]);
        expect(markdown).not.toMatch(/NaN|undefined/);
    });

    it("emits nothing for scene beats in any status", () => {
        expect(blocksToMarkdown(parseEditorState(sceneBeatOnlyState))).toBe("");
    });

    it("emits nothing for an empty document", () => {
        expect(blocksToMarkdown(parseEditorState(emptyDocumentState))).toBe("");
    });

    it("leaves ordinary prose punctuation alone", () => {
        const prose = "Don't — she said “no”, then (finally) left; 50% done…";
        expect(render([{ type: "paragraph", children: [textNode(prose)] }])).toBe(prose);
    });

    it("escapes a leading hash but not one mid-sentence", () => {
        expect(render([{ type: "paragraph", children: [textNode("# not a heading")] }])).toBe("\\# not a heading");
        expect(render([{ type: "paragraph", children: [textNode("see issue #7")] }])).toBe("see issue #7");
    });

    it("escapes markup characters inside a marked run", () => {
        expect(render([{ type: "paragraph", children: [textNode("a*b", 1)] }])).toBe("**a\\*b**");
    });

    it("degrades an unknown block to its inline text", () => {
        const children = [{ type: "quote", children: [textNode("kept "), textNode("prose", 2)] }];
        expect(render(children)).toBe("kept *prose*");
    });
});
