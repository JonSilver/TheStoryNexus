import { describe, expect, it } from "vitest";
import { changedWordCount, isSignificantChange, proseOf, sameDocument } from "./proseChange.js";

const doc = (...paragraphs: string[]) =>
    JSON.stringify({
        root: {
            type: "root",
            version: 1,
            children: paragraphs.map(text => ({
                type: "paragraph",
                version: 1,
                children: [{ type: "text", version: 1, text, format: 0 }]
            }))
        }
    });

describe("sameDocument", () => {
    it("ignores key order", () => {
        const a = JSON.stringify({ root: { type: "root", children: [], version: 1 } });
        const b = JSON.stringify({ root: { version: 1, children: [], type: "root" } });
        expect(a).not.toBe(b);
        expect(sameDocument(a, b)).toBe(true);
    });

    it("sees a one-character edit", () => {
        expect(sameDocument(doc("The keeper waited."), doc("The keeper waited!"))).toBe(false);
    });

    it("treats unparseable content as equal only to itself", () => {
        expect(sameDocument("{oops", "{oops")).toBe(true);
        expect(sameDocument("{oops", doc("x"))).toBe(false);
    });
});

describe("proseOf", () => {
    it("extracts paragraph text", () => {
        expect(proseOf(doc("One.", "Two."))).toBe("One.\n\nTwo.");
    });

    it("is empty for an empty chapter and null for garbage", () => {
        expect(proseOf("")).toBe("");
        expect(proseOf("{oops")).toBeNull();
    });
});

describe("significance", () => {
    const words = (n: number, word = "harbour") => Array.from({ length: n }, () => word).join(" ");

    it("counts words added or removed, ignoring case and punctuation", () => {
        expect(changedWordCount("The keeper waited.", "the keeper, waited")).toBe(0);
        expect(changedWordCount("The keeper waited.", "The keeper waited and watched.")).toBe(2);
        expect(changedWordCount("a b c", "a b d")).toBe(2);
    });

    it("a few typed words are not significant", () => {
        const base = words(400);
        expect(isSignificantChange(base, `${base} and then a few more words`)).toBe(false);
    });

    it("a new paragraph in a short chapter is significant", () => {
        expect(isSignificantChange(words(200), `${words(200)} ${words(60, "lantern")}`)).toBe(true);
    });

    it("scales with the chapter: 5% of a long chapter", () => {
        const base = words(4000);
        expect(isSignificantChange(base, `${base} ${words(150, "lantern")}`)).toBe(false);
        expect(isSignificantChange(base, `${base} ${words(200, "lantern")}`)).toBe(true);
    });
});
