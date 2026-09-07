import { describe, expect, it } from "vitest";
import { cleanPlainText, stripMessageHeaders, stripSignature, unwrapHardLines } from "./clean.js";

describe("stripMessageHeaders", () => {
    it("removes a usenet header block at the start", () => {
        const text = [
            "From: author@example.com (A. Writer)",
            "Newsgroups: alt.fiction.original",
            "Subject: The Harbour - Part 1/3",
            "Date: 12 Mar 1997 10:11:12 GMT",
            "",
            "The tide was wrong that morning."
        ].join("\n");
        expect(stripMessageHeaders(text)).toBe("The tide was wrong that morning.");
    });

    it("removes header blocks between concatenated parts", () => {
        const text = [
            "Part one prose.",
            "",
            "From: author@example.com",
            "Subject: The Harbour - Part 2/3",
            "",
            "Part two prose."
        ].join("\n");
        expect(stripMessageHeaders(text)).toBe("Part one prose.\n\nPart two prose.");
    });

    it("leaves prose containing a lone header-like line alone", () => {
        const text = "She read the note.\n\nSubject: dinner. That was all it said.";
        expect(stripMessageHeaders(text)).toBe(text);
    });
});

describe("stripSignature", () => {
    it("removes a trailing sig block after the -- delimiter", () => {
        const text = "The end of the tale.\n\n-- \nA. Writer\nhttp://example.com/fic";
        expect(stripSignature(text)).toBe("The end of the tale.");
    });

    it("ignores -- deep inside the text", () => {
        const lines = ["--", ...Array.from({ length: 30 }, (_, i) => `Line ${i} of an ongoing story.`)];
        expect(stripSignature(lines.join("\n"))).toBe(lines.join("\n"));
    });
});

describe("unwrapHardLines", () => {
    it("rejoins 72-column wrapped paragraphs into flowing prose", () => {
        const paragraph = [
            "The keeper had watched the harbour for thirty years and in all that",
            "time the sea had never once looked the way it looked on the morning",
            "the freighter came in with her engines dead and her stern riding low."
        ].join("\n");
        const text = Array.from({ length: 5 }, () => paragraph).join("\n\n");
        const result = unwrapHardLines(text);
        expect(result).not.toContain("that\ntime");
        expect(result).toContain("in all that time the sea");
        expect(result.split("\n\n")).toHaveLength(5);
    });

    it("leaves normally formatted text untouched", () => {
        const text = "A short line.\n\nAnother paragraph that flows naturally without any hard wrapping at all.";
        expect(unwrapHardLines(text)).toBe(text);
    });
});

describe("cleanPlainText", () => {
    it("handles the full archived-post shape", () => {
        const body = [
            "The keeper had watched the harbour for thirty years and in all that",
            "time the sea had never once looked the way it looked on the morning",
            "the freighter came in with her engines dead and her stern riding low.",
            "",
            "He reached for the telephone before the second wave hit the wall and",
            "the glass in the lamp-room rattled loose in its ancient iron frame,",
            "spilling light across the water in long uneven stripes of yellow.",
            "",
            "He reached for the telephone before the second wave hit the wall and",
            "the glass in the lamp-room rattled loose in its ancient iron frame,",
            "spilling light across the water in long uneven stripes of yellow.",
            "",
            "He reached for the telephone before the second wave hit the wall and",
            "the glass in the lamp-room rattled loose in its ancient iron frame,",
            "spilling light across the water in long uneven stripes of yellow."
        ].join("\n");
        const text = ["From: a@b.c", "Subject: Part 1", "", body, "", "-- ", "A. Writer"].join("\n");
        const cleaned = cleanPlainText(text);
        expect(cleaned).not.toContain("From:");
        expect(cleaned).not.toContain("A. Writer");
        expect(cleaned).toContain("in all that time the sea");
    });
});

describe("pathological input (the spin that took the server down)", () => {
    it("splits a huge unwrapped separator-heavy text in bounded time", async () => {
        const { splitIntoChapters } = await import("./split.js");
        const hugeSeparatorLine = "*** ".repeat(20_000);
        const prose = "A perfectly ordinary paragraph of story prose that runs along nicely. ".repeat(40);
        const text = [prose, hugeSeparatorLine, prose, hugeSeparatorLine, prose].join("\n\n");
        const start = Date.now();
        const chapters = splitIntoChapters(cleanPlainText(text));
        expect(Date.now() - start).toBeLessThan(2_000);
        expect(chapters.length).toBeGreaterThan(0);
    });

    it("unwrap keeps scene dividers and headings on their own lines", () => {
        const wrapped = [
            "He reached for the telephone before the second wave hit the wall and",
            "the glass in the lamp-room rattled loose in its ancient iron frame."
        ];
        const text = [
            "The keeper had watched the harbour for thirty years and in all that",
            "time the sea had never once looked the way it looked on the morning.",
            "* * *",
            ...wrapped,
            ...wrapped,
            ...wrapped,
            ...wrapped,
            ...wrapped
        ].join("\n");
        const result = unwrapHardLines(text);
        expect(result).toContain("\n* * *\n");
        expect(result).toContain("that time the sea");
    });
});
