import { attemptPromise } from "@jfdi/attempt";
import { describe, expect, it } from "vitest";
import { extensionOf, ingestStatusOf, isSupportedManuscript, parseManuscript, parseManuscriptText } from "./parse.js";

const utf8 = (text: string) => Buffer.from(text, "utf-8");

const failure = async (filename: string, buffer: Buffer) => {
    const [error] = await attemptPromise(() => parseManuscript(filename, buffer));
    expect(error).toBeTruthy();
    return { message: (error as Error).message, status: ingestStatusOf(error as Error) };
};

describe("extension routing", () => {
    it.each([
        ["novel.txt", "txt"],
        ["Novel.MD", "md"],
        ["a.b.docx", "docx"],
        ["book.epub", "epub"],
        ["noextension", ""]
    ])("reads the extension of %s", (filename, expected) => {
        expect(extensionOf(filename)).toBe(expected);
    });

    it.each(["a.txt", "a.md", "a.docx", "a.epub", "A.EPUB"])("accepts %s", filename => {
        expect(isSupportedManuscript(filename)).toBe(true);
    });

    it.each(["a.pdf", "a.rtf", "a.doc", "a.odt", "a.html", "a", "a.txt.exe"])("rejects %s", filename => {
        expect(isSupportedManuscript(filename)).toBe(false);
    });
});

describe("parseManuscript — error paths", () => {
    it("rejects an unsupported extension with 415", async () => {
        const { status, message } = await failure("manuscript.pdf", utf8("text"));
        expect(status).toBe(415);
        expect(message).toContain(".txt, .md, .docx or .epub");
    });

    it("rejects an empty file", async () => {
        expect((await failure("novel.txt", Buffer.alloc(0))).status).toBe(400);
    });

    it("rejects a file over the 20 MB cap with 413", async () => {
        const oversized = Buffer.alloc(20 * 1024 * 1024 + 1, 0x61);
        expect((await failure("novel.txt", oversized)).status).toBe(413);
    });

    it("rejects a file with no readable text with 422", async () => {
        expect((await failure("novel.txt", utf8("   \n\n\t "))).status).toBe(422);
    });

    it("reports a malformed .epub as a bad file rather than a server fault", async () => {
        const { status, message } = await failure("novel.epub", utf8("not a zip at all"));
        expect(status).toBe(422);
        expect(message).toContain(".epub");
    });

    it("reports a malformed .docx as a bad file rather than a server fault", async () => {
        const { status, message } = await failure("novel.docx", utf8("not a zip at all"));
        expect(status).toBe(422);
        expect(message).toContain(".docx");
    });
});

describe("parseManuscript — plain text and markdown", () => {
    it("decodes utf-8 and strips a byte-order mark", async () => {
        const parsed = await parseManuscript("novel.txt", utf8("﻿Zoë walked to the café."));
        expect(parsed.text).toBe("Zoë walked to the café.");
    });

    it("normalises CRLF, non-breaking spaces and trailing whitespace", async () => {
        const parsed = await parseManuscript("novel.txt", utf8("One line   \r\nNext line\r\n"));
        expect(parsed.text).toBe("One line\nNext line");
    });

    it("collapses runs of blank lines", async () => {
        const parsed = await parseManuscript("novel.txt", utf8("One.\n\n\n\n\nTwo."));
        expect(parsed.text).toBe("One.\n\nTwo.");
    });

    it("keeps raw markdown rather than rendering it", async () => {
        const parsed = await parseManuscript("novel.md", utf8("## Chapter\n\n**bold** text"));
        expect(parsed.text).toContain("## Chapter");
        expect(parsed.text).toContain("**bold**");
    });
});

describe("parseManuscript — titles", () => {
    it("falls back to a tidied filename", async () => {
        const parsed = await parseManuscript("The_Iron_Keep.txt", utf8("Prose."));
        expect(parsed.title).toBe("The Iron Keep");
    });

    it("takes a leading # heading as the title when further headings follow", async () => {
        const parsed = await parseManuscript("draft.md", utf8("# The Iron Keep\n\n## One\n\nProse.\n"));
        expect(parsed.title).toBe("The Iron Keep");
        expect(parsed.text).toBe("## One\n\nProse.");
    });

    it("leaves a lone leading heading in place for the splitter", async () => {
        const parsed = await parseManuscript("draft.md", utf8("# Chapter One\n\nProse."));
        expect(parsed.title).toBe("draft");
        expect(parsed.text).toBe("# Chapter One\n\nProse.");
    });
});

describe("parseManuscriptText", () => {
    it("uses the supplied title in preference to anything in the text", () => {
        const parsed = parseManuscriptText("# Inferred\n\n## One\n\nProse.", "  Chosen  ");
        expect(parsed.title).toBe("Chosen");
    });

    it("infers a title from a leading heading when none is supplied", () => {
        expect(parseManuscriptText("# Inferred\n\n## One\n\nProse.").title).toBe("Inferred");
    });

    it("names untitled pastes", () => {
        expect(parseManuscriptText("Just some prose.").title).toBe("Imported Manuscript");
    });

    it("rejects an empty paste", () => {
        expect(() => parseManuscriptText("   ")).toThrow(/No text/);
    });
});
