import { describe, expect, it } from "vitest";
import {
    entryKey,
    issueKey,
    updateKey,
    newItems,
    parseContinuityIssues,
    parseEntryProposals,
    parseUpdateProposals
} from "./parseProposals";

describe("parseEntryProposals", () => {
    it("parses a clean JSON array", () => {
        const text = '[{"name":"Mara","category":"character","description":"Captain.","tags":["the captain"]}]';
        expect(parseEntryProposals(text)).toEqual([
            { name: "Mara", category: "character", description: "Captain.", tags: ["the captain"] }
        ]);
    });

    it("strips code fences and surrounding prose", () => {
        const text =
            'Here you go:\n```json\n[{"name":"Iron Keep","category":"location","description":"A fortress."}]\n```\nHope that helps!';
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
        const text =
            '[{"name":"Mara","updatedDescription":"Now harbourmaster.","reason":"Promoted"},{"name":"B","updatedDescription":"x"}]';
        expect(parseUpdateProposals(text)).toEqual([
            { name: "Mara", updatedDescription: "Now harbourmaster.", reason: "Promoted" },
            { name: "B", updatedDescription: "x", reason: "" }
        ]);
    });

    it("returns empty for empty array responses", () => {
        expect(parseUpdateProposals("[]")).toEqual([]);
    });
});

describe("parseContinuityIssues", () => {
    it("parses issues and tolerates missing evidence", () => {
        const text =
            '[{"name":"Quill","issue":"Eyes were blue in ch1, green here.","evidence":"his green eyes"},{"name":"X","issue":"y"}]';
        expect(parseContinuityIssues(text)).toEqual([
            { name: "Quill", issue: "Eyes were blue in ch1, green here.", evidence: "his green eyes" },
            { name: "X", issue: "y", evidence: "" }
        ]);
    });

    it("returns empty for clean chapters", () => {
        expect(parseContinuityIssues("[]")).toEqual([]);
        expect(parseContinuityIssues("No issues found.")).toEqual([]);
    });
});

describe("newItems", () => {
    it("treats a rerun's reworded, retagged entry as the same entry", () => {
        const listed = [
            { name: "Colonel Brandon", category: "character" as const, description: "A soldier.", tags: ["a", "b"] }
        ];
        const rerun = [
            {
                name: "colonel  brandon",
                category: "character" as const,
                description: "A retired soldier.",
                tags: ["b", "a"]
            },
            { name: "Marianne", category: "character" as const, description: "A sister.", tags: [] },
            { name: "MARIANNE", category: "character" as const, description: "Romantic.", tags: [] }
        ];
        expect(newItems(listed, rerun, entryKey).map(p => p.description)).toEqual(["A sister."]);
    });

    it("keeps distinct continuity issues for one entry but drops a repeated one", () => {
        const listed = [{ name: "Elinor", issue: "Eyes are blue, later brown", evidence: "ch1" }];
        const rerun = [
            { name: "elinor", issue: "Eyes are  blue, later brown", evidence: "ch3" },
            { name: "Elinor", issue: "Age changes from 19 to 21", evidence: "ch2" }
        ];
        expect(newItems(listed, rerun, issueKey).map(i => i.issue)).toEqual(["Age changes from 19 to 21"]);
    });

    it("keeps a rerun's different update for a listed entry but drops the same one", () => {
        const listed = [{ name: "Elinor", updatedDescription: "Now married.", reason: "ch4" }];
        const rerun = [
            { name: "ELINOR", updatedDescription: "Now  married.", reason: "ch5" },
            { name: "Elinor", updatedDescription: "Married to Edward; lives at Delaford.", reason: "ch5" }
        ];
        expect(newItems(listed, rerun, updateKey).map(u => u.updatedDescription)).toEqual([
            "Married to Edward; lives at Delaford."
        ]);
    });
});
