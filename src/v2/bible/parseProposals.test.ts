import { describe, expect, it } from "vitest";
import { parseEntryProposals, parseUpdateProposals } from "./parseProposals";

describe("parseEntryProposals", () => {
    it("parses a clean JSON array", () => {
        const text = '[{"name":"Mara","category":"character","description":"Captain.","tags":["the captain"]}]';
        expect(parseEntryProposals(text)).toEqual([
            { name: "Mara", category: "character", description: "Captain.", tags: ["the captain"] }
        ]);
    });

    it("strips code fences and surrounding prose", () => {
        const text = 'Here you go:\n```json\n[{"name":"Iron Keep","category":"location","description":"A fortress."}]\n```\nHope that helps!';
        const parsed = parseEntryProposals(text);
        expect(parsed).toHaveLength(1);
        expect(parsed[0].name).toBe("Iron Keep");
        expect(parsed[0].tags).toEqual([]);
    });

    it("defaults unknown categories to note and drops malformed items", () => {
        const text = '[{"name":"X","category":"vehicle","description":"A cart."},{"name":42},{"description":"orphan"}]';
        expect(parseEntryProposals(text)).toEqual([{ name: "X", category: "note", description: "A cart.", tags: [] }]);
    });

    it("returns empty for non-JSON output", () => {
        expect(parseEntryProposals("I could not find any entries.")).toEqual([]);
    });

    it("filters non-string tags", () => {
        const text = '[{"name":"A","category":"item","description":"d","tags":["ok",7,null]}]';
        expect(parseEntryProposals(text)[0].tags).toEqual(["ok"]);
    });
});

describe("parseUpdateProposals", () => {
    it("parses updates and tolerates missing reason", () => {
        const text = '[{"name":"Mara","updatedDescription":"Now harbourmaster.","reason":"Promoted"},{"name":"B","updatedDescription":"x"}]';
        expect(parseUpdateProposals(text)).toEqual([
            { name: "Mara", updatedDescription: "Now harbourmaster.", reason: "Promoted" },
            { name: "B", updatedDescription: "x", reason: "" }
        ]);
    });

    it("returns empty for empty array responses", () => {
        expect(parseUpdateProposals("[]")).toEqual([]);
    });
});
