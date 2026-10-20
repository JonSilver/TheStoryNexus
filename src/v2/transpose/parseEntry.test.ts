import { describe, expect, it } from "vitest";
import { parseTransposedEntry } from "./parseEntry";

const brennan = { name: "Mrs Brennan", description: "Runs the shop.", tags: ["Ma"] };

describe("parseTransposedEntry", () => {
    it("reads the array the prompt asks for", () => {
        expect(parseTransposedEntry(JSON.stringify([brennan]))).toEqual(brennan);
    });

    it("reads a lone object, wrapped in chat and code fences", () => {
        expect(
            parseTransposedEntry(`Here's the entry:\n\`\`\`json\n${JSON.stringify(brennan)}\n\`\`\`\nHope that helps!`)
        ).toEqual(brennan);
    });

    it("takes aliases for tags", () => {
        expect(
            parseTransposedEntry('{"name": "Mrs Brennan", "description": "Runs the shop.", "aliases": ["Ma"]}')
        ).toEqual(brennan);
    });

    it("reads labelled lines, Markdown and all", () => {
        expect(
            parseTransposedEntry(
                "**Name:** Mrs Brennan\n**Description:** Runs the shop.\nKnows everyone.\n**Also called:** Ma"
            )
        ).toEqual({ name: "Mrs Brennan", description: "Runs the shop.\nKnows everyone.", tags: ["Ma"] });
    });

    it("finds nothing in prose with no name and description", () => {
        expect(parseTransposedEntry("Mrs Brennan would be a shopkeeper in Belfast.")).toBeNull();
    });
});
