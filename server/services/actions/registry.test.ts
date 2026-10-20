import { describe, expect, it } from "vitest";
import { BUILTIN_ACTIONS } from "./registry";

describe("prose actions", () => {
    // Their replies are offered for the manuscript itself
    it("are exactly the ones that insert prose", () => {
        const flagged = Object.values(BUILTIN_ACTIONS)
            .filter(def => def.insertsProse)
            .map(def => def.id)
            .sort();
        expect(flagged).toEqual(["ask", "continue", "expand", "rework", "scene_beat", "shorten"]);
    });
});
