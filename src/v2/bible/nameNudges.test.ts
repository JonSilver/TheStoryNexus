import { describe, expect, it } from "vitest";
import { findUnmatchedNames } from "./nameNudges";

const story =
    "The rain fell as Kestrel walked the pier. Nobody noticed when Kestrel slipped past the gate, " +
    "and only the keeper saw Kestrel leave. She thought of Brandt often; meeting Brandt had changed " +
    "everything, though Brandt never knew. The harbour was quiet. Quiet suited her.";

describe("findUnmatchedNames", () => {
    it("finds recurring mid-sentence names not in the bible", () => {
        expect(findUnmatchedNames(story, [])).toEqual(expect.arrayContaining(["Kestrel", "Brandt"]));
    });

    it("excludes names already in the bible (case-insensitive, incl. word match)", () => {
        expect(findUnmatchedNames(story, ["kestrel"])).toEqual(["Brandt"]);
        expect(findUnmatchedNames(story, ["Captain Brandt"])).toEqual(["Kestrel"]);
    });

    it("ignores sentence-initial capitals and stop words", () => {
        const text = "Quiet fell. Quiet stayed. Quiet won. The night and The dark and The cold.";
        expect(findUnmatchedNames(text, [])).toEqual([]);
    });

    it("requires three occurrences", () => {
        const text = "She saw Marlow once. Later she met Marlow again.";
        expect(findUnmatchedNames(text, [])).toEqual([]);
    });
});
