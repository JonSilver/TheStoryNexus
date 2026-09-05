import { describe, expect, it } from "vitest";
import { type Block, type EditorStateJson, type Mark, parseEditorState, parseSerialisedDocument } from "./blocks.js";
import { MARK_COMBINATIONS, kitchenSinkJson, kitchenSinkState, sceneBeatOnlyState } from "./fixtures.js";

const blocks = parseSerialisedDocument(kitchenSinkJson);

const blocksOfType = <T extends Block["type"]>(type: T) =>
    blocks.filter((block): block is Extract<Block, { type: T }> => block.type === type);

const stateOf = (...children: Record<string, unknown>[]): EditorStateJson => ({ root: { type: "root", children } });

const textNode = (text: string, format = 0) => ({ type: "text", text, format });

describe("parseSerialisedDocument", () => {
    it("parses the serialised JSON identically to the in-memory state", () => {
        expect(blocks).toEqual(parseEditorState(kitchenSinkState));
    });

    it("throws a clear error for malformed JSON", () => {
        expect(() => parseSerialisedDocument("{ not json")).toThrow(/^Invalid document JSON: /);
    });

    it("throws a clear error for a document without a root", () => {
        expect(() => parseSerialisedDocument("{}")).toThrow('Invalid document: missing "root" node');
    });

    it("throws a clear error when root.children is not an array", () => {
        expect(() => parseSerialisedDocument('{"root":{"children":"nope"}}')).toThrow(
            'Invalid document: "root.children" must be an array'
        );
    });
});

describe("inline marks", () => {
    const EXPECTED_MARKS: Record<number, Mark[]> = {
        0: [],
        1: ["bold"],
        2: ["italic"],
        8: ["underline"],
        3: ["bold", "italic"],
        9: ["bold", "underline"],
        10: ["italic", "underline"],
        11: ["bold", "italic", "underline"]
    };

    it.each(MARK_COMBINATIONS)("maps format $format to the $label marks", ({ label, format }) => {
        const [block] = parseEditorState(stateOf({ type: "paragraph", children: [textNode(label, format)] }));
        expect(block).toEqual({
            type: "paragraph",
            content: [{ type: "text", text: label, marks: EXPECTED_MARKS[format] }]
        });
    });

    it("ignores format bits outside bold/italic/underline", () => {
        // strikethrough (4), code (16), subscript (32) carry no v2 mark.
        const [block] = parseEditorState(stateOf({ type: "paragraph", children: [textNode("x", 4 | 16 | 32)] }));
        expect(block).toEqual({ type: "paragraph", content: [{ type: "text", text: "x", marks: [] }] });
    });

    it("drops empty text runs and keeps line breaks", () => {
        const children = [textNode(""), { type: "linebreak" }, textNode("after")];
        const [block] = parseEditorState(stateOf({ type: "paragraph", children }));
        expect(block).toEqual({
            type: "paragraph",
            content: [{ type: "lineBreak" }, { type: "text", text: "after", marks: [] }]
        });
    });
});

describe("headings", () => {
    const headingState = (tag: string) => stateOf({ type: "heading", tag, children: [textNode("Title")] });

    it.each([
        ["h1", 1],
        ["h2", 2],
        ["h3", 3],
        ["h4", 3],
        ["h5", 3],
        ["h6", 3]
    ])("maps %s to level %i", (tag, level) => {
        expect(parseEditorState(headingState(tag))[0]).toMatchObject({ type: "heading", level });
    });

    it("falls back to level 1 for a missing or unparseable tag", () => {
        expect(parseEditorState(headingState(""))[0]).toMatchObject({ level: 1 });
        expect(parseEditorState(stateOf({ type: "heading", children: [textNode("Title")] }))[0]).toMatchObject({
            level: 1
        });
    });
});

describe("lists", () => {
    it("nests a wrapper list item's list as the item's children", () => {
        expect(blocksOfType("bulletList")[0]).toEqual({
            type: "bulletList",
            start: 1,
            items: [
                { content: [{ type: "text", text: "Alpha", marks: [] }], children: [] },
                {
                    content: [],
                    children: [
                        {
                            type: "bulletList",
                            start: 1,
                            items: [{ content: [{ type: "text", text: "Alpha nested", marks: [] }], children: [] }]
                        }
                    ]
                },
                {
                    content: [
                        { type: "text", text: "Beta ", marks: [] },
                        { type: "text", text: "bold", marks: ["bold"] }
                    ],
                    children: []
                }
            ]
        });
    });

    it("keeps the ordered-list start value", () => {
        expect(blocksOfType("orderedList").map(list => list.start)).toEqual([1, 3]);
    });
});

describe("scene beats", () => {
    it("parses a fully populated beat", () => {
        expect(blocksOfType("sceneBeat")[0]).toEqual({
            type: "sceneBeat",
            command: "Mara confronts the steward about the missing ledger.",
            status: "done",
            generatedText: "Mara set the ledger down and waited for him to lie.",
            collapsed: true,
            povCharacter: "Mara",
            povType: "First Person"
        });
    });

    it("supplies defaults for the omitted fields Lexical does not serialise", () => {
        expect(blocksOfType("sceneBeat")[1]).toEqual({
            type: "sceneBeat",
            command: "",
            status: "idle",
            generatedText: "",
            collapsed: false
        });
    });

    it("falls back to idle for an unrecognised status", () => {
        const [block] = parseEditorState(stateOf({ type: "scene-beat", status: "exploded" }));
        expect(block).toMatchObject({ status: "idle" });
    });

    it("keeps every beat in the intermediate list regardless of status", () => {
        expect(parseEditorState(sceneBeatOnlyState)).toHaveLength(3);
    });
});

describe("images and unknown nodes", () => {
    it("accepts both alt and Lexical's altText, and keeps an optional caption", () => {
        const images = blocksOfType("image");
        expect(images[0]).toEqual({ type: "image", src: "/api/assets/s1/keep.png", alt: "A keep at dusk" });
        expect(images[1]).toEqual({
            type: "image",
            src: "/api/assets/s1/ash (2).png",
            alt: "Ash & <Mara>",
            caption: 'Ash & Mara at the "gate"'
        });
    });

    it("drops an image with no src", () => {
        expect(parseEditorState(stateOf({ type: "image", altText: "orphan" }))).toEqual([]);
    });

    it("degrades an unknown block to a paragraph of its inline descendants", () => {
        const [block] = parseEditorState(
            stateOf({
                type: "custom-callout",
                children: [{ type: "paragraph", children: [textNode("buried"), textNode(" prose", 1)] }]
            })
        );
        expect(block).toEqual({
            type: "paragraph",
            content: [
                { type: "text", text: "buried", marks: [] },
                { type: "text", text: " prose", marks: ["bold"] }
            ]
        });
    });

    it("does not harvest text from a beat nested inside an unknown block", () => {
        const [block] = parseEditorState(
            stateOf({
                type: "custom-callout",
                children: [{ type: "scene-beat", command: "hidden", generatedText: "hidden too" }]
            })
        );
        expect(block).toEqual({ type: "paragraph", content: [] });
    });
});
