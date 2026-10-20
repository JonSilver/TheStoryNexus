import { describe, expect, it } from "vitest";
import { machineryIn, piecesOf, prosePieces, rebuildChapter, wordCountOf } from "./pieces";

const text = (t: string) => ({ type: "text", text: t, format: 0, detail: 0, mode: "normal", style: "", version: 1 });
const para = (t: string) => ({ type: "paragraph", children: [text(t)], version: 1 });
const doc = (...children: unknown[]) => JSON.stringify({ root: { type: "root", children } });
const hr = { type: "horizontalrule", version: 1 };
const image = { type: "image", src: "/api/assets/s/map.png", alt: "map", version: 1 };
const beat = { type: "scene-beat-v2", command: "Write the duel", takes: ["A draft"], version: 1 };

describe("chapter pieces", () => {
    it("splits prose at scene breaks and images, keeping them, and drops writing machinery", () => {
        const pieces = piecesOf(doc(para("One."), para("Two."), hr, beat, para("Three."), image, para("Four.")));
        expect(pieces.map(p => (p.kind === "prose" ? p.text : p.node.type))).toEqual([
            "One.\n\nTwo.",
            "horizontalrule",
            "Three.",
            "image",
            "Four."
        ]);
        expect(machineryIn(doc(para("x"), beat))).toBe(1);
    });

    it("keeps each run of prose under the size limit, splitting between paragraphs", () => {
        const pieces = piecesOf(doc(para("a b c"), para("d e f"), para("g h")), 6);
        expect(prosePieces(pieces).map(p => p.text)).toEqual(["a b c\n\nd e f", "g h"]);
    });

    it("rebuilds the chapter with each piece's rewrite, keeping images and breaks where they were", () => {
        const pieces = piecesOf(doc(para("Old one."), hr, image, para("Old two.")));
        const rebuilt = JSON.parse(rebuildChapter(pieces, ["New one.\n\nNew one, again.\nA line.", "New two."]));
        const kinds = rebuilt.root.children.map((n: { type: string }) => n.type);
        expect(kinds).toEqual(["paragraph", "paragraph", "horizontalrule", "image", "paragraph"]);
        expect(rebuilt.root.children[1].children.map((n: { type: string }) => n.type)).toEqual([
            "text",
            "linebreak",
            "text"
        ]);
        expect(rebuilt.root.children[3].src).toBe("/api/assets/s/map.png");
        expect(prosePieces(piecesOf(JSON.stringify(rebuilt))).map(p => p.text)).toEqual([
            "New one.\n\nNew one, again.\nA line.",
            "New two."
        ]);
        expect(wordCountOf(["New one.", "New two."])).toBe(4);
    });

    it("an unreadable or empty chapter has no pieces", () => {
        expect(piecesOf("not json")).toEqual([]);
        expect(piecesOf(doc(para("  ")))).toEqual([]);
    });
});
