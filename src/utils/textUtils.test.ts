import { describe, expect, it } from "vitest";
import { countWords } from "./textUtils";

describe("countWords", () => {
    it("counts simple words", () => {
        expect(countWords("Hello world")).toBe(2);
    });

    it("ignores punctuation and extra whitespace", () => {
        expect(countWords("Hello,  world!\n\nAgain.")).toBe(3);
    });

    it("returns 0 for empty or whitespace-only text", () => {
        expect(countWords("")).toBe(0);
        expect(countWords("   \n ")).toBe(0);
    });

    it("handles apostrophes as single words", () => {
        expect(countWords("don't stop")).toBe(2);
    });
});
