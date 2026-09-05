import { describe, expect, it } from "vitest";
import { parseEditorState, parseSerialisedDocument } from "./blocks.js";
import { emptyDocumentState, kitchenSinkJson, sceneBeatOnlyState } from "./fixtures.js";
import { blocksToPlainText } from "./toPlainText.js";

const plain = blocksToPlainText(parseSerialisedDocument(kitchenSinkJson));

const render = (children: Record<string, unknown>[]) =>
    blocksToPlainText(parseEditorState({ root: { type: "root", children } }));

const textNode = (text: string, format = 0) => ({ type: "text", text, format });

const EXPECTED = [
    "The Iron Keep",
    "",
    "Chapter Two",
    "",
    "Aftermath",
    "",
    "Too Deep",
    "",
    "plain bold italic underline bold italic bold underline italic underline all three",
    "",
    'He said "don\'t" — a_b, *star*, [bracket], `tick`, back\\slash and issue #5.',
    "",
    "#hashtag opens the line",
    "",
    "First line",
    "second line",
    "",
    "Before\tafter",
    "",
    "linked prose",
    "",
    "Alpha",
    "  Alpha nested",
    "Beta bold",
    "",
    "First",
    "  Nested one",
    "  Nested two",
    "Second",
    "",
    "Third",
    "Fourth",
    "",
    "An unknown block keeps its prose",
    "",
    "Nested unknown prose"
].join("\n");

describe("blocksToPlainText", () => {
    it("renders the whole fixture document exactly", () => {
        expect(plain).toBe(EXPECTED);
    });

    it("adds no markup of its own", () => {
        // The author's literal `*star*` and `#hashtag` survive verbatim; nothing is wrapped or escaped.
        expect(plain).not.toMatch(/\*\*|<u>|<\/|^\s*[-*] |^\s*\d+\. |\\[\\`*_[\]#]/m);
        expect(plain).not.toMatch(/NaN|undefined/);
    });

    it("drops marks instead of rendering them", () => {
        expect(render([{ type: "paragraph", children: [textNode("all three", 11)] }])).toBe("all three");
    });

    it("emits nothing for scene beats in any status", () => {
        expect(blocksToPlainText(parseEditorState(sceneBeatOnlyState))).toBe("");
    });

    it("emits nothing for an empty document", () => {
        expect(blocksToPlainText(parseEditorState(emptyDocumentState))).toBe("");
    });

    it("omits images and horizontal rules but keeps the prose either side", () => {
        const children = [
            { type: "paragraph", children: [textNode("Before")] },
            { type: "image", src: "/api/assets/s1/keep.png", altText: "A keep" },
            { type: "horizontalrule" },
            { type: "paragraph", children: [textNode("After")] }
        ];
        expect(render(children)).toBe("Before\n\nAfter");
    });

    it("degrades an unknown block to its text", () => {
        const children = [{ type: "quote", children: [textNode("kept "), textNode("prose", 2)] }];
        expect(render(children)).toBe("kept prose");
    });
});
