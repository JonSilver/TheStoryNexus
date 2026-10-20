import { describe, expect, it } from "vitest";
import { initialState, pendingEntries, readStage, readState, remapState, syncEntries } from "./state";

const hester = { name: "Aunt Hester", category: "character", description: "Formidable.", tags: ["Hetty"] };

describe("transposition state", () => {
    it("starts with the synopsis and every entry pending, in bible order", () => {
        const state = initialState("A synopsis.", [
            { id: "e1", ...hester },
            { id: "e2", name: "Whitwell", category: "location", description: "A hall.", tags: [] }
        ]);
        expect(state.synopsis.original).toBe("A synopsis.");
        expect(state.entryOrder).toEqual(["e1", "e2"]);
        expect(pendingEntries(state)).toEqual(["e1", "e2"]);
    });

    it("reads untrusted or older JSON into a whole state", () => {
        expect(readState(null)).toEqual({
            briefAttempts: [],
            synopsis: { original: "", attempts: [] },
            entries: {},
            entryOrder: []
        });
        const state = readState({
            briefAttempts: ["one", 2],
            entries: { e1: { original: hester, attempts: [{ name: "Ma" }], status: "bogus" } },
            entryOrder: ["missing", "e1", "e1"]
        });
        expect(state.briefAttempts).toEqual(["one"]);
        expect(state.entries.e1.status).toBe("pending");
        expect(state.entries.e1.attempts[0]).toEqual({ name: "Ma", category: "note", description: "", tags: [] });
        // Unknown ids dropped, duplicates collapsed
        expect(state.entryOrder).toEqual(["e1"]);
        expect(readStage("bible")).toBe("bible");
        expect(readStage("nonsense")).toBe("brief");
    });

    it("moves its entries to a restored copy's ids, dropping any that didn't come", () => {
        const state = initialState("", [
            { id: "old1", ...hester },
            { id: "old2", ...hester, name: "Gone" }
        ]);
        const moved = remapState(state, new Map([["old1", "new1"]]));
        expect(Object.keys(moved.entries)).toEqual(["new1"]);
        expect(moved.entryOrder).toEqual(["new1"]);
        expect(moved.entries.new1.original.name).toBe("Aunt Hester");
    });
});

describe("syncEntries", () => {
    it("follows the live bible until it's settled: deleted entries leave, new ones join, undecided ones update", () => {
        const base = initialState("", [
            { id: "e1", ...hester },
            { id: "e2", ...hester, name: "Deleted" },
            { id: "e3", ...hester, name: "Decided" }
        ]);
        const decided = {
            ...base,
            entries: { ...base.entries, e3: { ...base.entries.e3, status: "accepted" as const } }
        };
        const synced = syncEntries(decided, [
            { id: "e1", ...hester, description: "Edited in the Bible screen." },
            { id: "e3", ...hester, name: "Mrs Brennan" },
            { id: "e4", ...hester, name: "New" }
        ]);
        expect(synced.entryOrder).toEqual(["e1", "e3", "e4"]);
        expect(synced.entries.e1.original.description).toBe("Edited in the Bible screen.");
        // A decided entry keeps how it was before it was transposed
        expect(synced.entries.e3.original.name).toBe("Decided");
        expect(synced.entries.e4.status).toBe("pending");
    });
});
