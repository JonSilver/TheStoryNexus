/**
 * EPUB and DOCX are zip containers, so the fixtures are built in memory rather than
 * committed as binaries — the archives are real, only their provenance differs.
 */
import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { parseManuscript } from "./parse.js";
import { splitIntoChapters } from "./split.js";

const archive = async (files: Record<string, string>): Promise<Buffer> => {
    const zip = new JSZip();
    Object.entries(files).forEach(([name, content]) => zip.file(name, content));
    return zip.generateAsync({ type: "nodebuffer" });
};

const CONTAINER = `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`;

const opf = (title: string, items: string[]) => `<?xml version="1.0"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>${title}</dc:title><dc:creator>A Writer</dc:creator>
  </metadata>
  <manifest>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${items.map((href, index) => `<item id="c${index}" href="${href}" media-type="application/xhtml+xml"/>`).join("\n")}
  </manifest>
  <spine toc="ncx">
    ${items.map((_, index) => `<itemref idref="c${index}"/>`).join("\n")}
  </spine>
</package>`;

const xhtml = (heading: string, body: string) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml"><head><title>${heading}</title>
<style>body { margin: 0 }</style></head>
<body><h2>${heading}</h2><p>${body}</p><p>Second &amp; last&nbsp;paragraph.</p></body></html>`;

const sampleEpub = () =>
    archive({
        mimetype: "application/epub+zip",
        "META-INF/container.xml": CONTAINER,
        "OEBPS/content.opf": opf("The Iron Keep", ["text/ch1.xhtml", "text/ch2.xhtml"]),
        "OEBPS/toc.ncx": "<ncx><navMap/></ncx>",
        "OEBPS/style.css": "body { margin: 0 }",
        "OEBPS/text/ch1.xhtml": xhtml("Chapter One", "The gate stood open."),
        "OEBPS/text/ch2.xhtml": xhtml("Chapter Two", "The steward was lying.")
    });

describe("EPUB ingestion", () => {
    it("takes the title from OPF metadata and the prose from the spine, in order", async () => {
        const parsed = await parseManuscript("whatever.epub", await sampleEpub());
        expect(parsed.title).toBe("The Iron Keep");
        expect(parsed.text).toBe(
            [
                "Chapter One",
                "The gate stood open.",
                "Second & last paragraph.",
                "Chapter Two",
                "The steward was lying.",
                "Second & last paragraph."
            ].join("\n\n")
        );
    });

    it("splits the extracted text into the manuscript's chapters", async () => {
        const parsed = await parseManuscript("whatever.epub", await sampleEpub());
        expect(splitIntoChapters(parsed.text).map(chapter => chapter.title)).toEqual([
            "Chapter One",
            "Chapter Two"
        ]);
    });

    it("ignores stylesheets, the ncx and head content", async () => {
        const parsed = await parseManuscript("whatever.epub", await sampleEpub());
        expect(parsed.text).not.toContain("margin");
        expect(parsed.text).not.toContain("navMap");
    });

    it("falls back to archive order when the spine is unusable", async () => {
        const buffer = await archive({
            "META-INF/container.xml": CONTAINER,
            "OEBPS/content.opf": opf("Spineless", []),
            "OEBPS/a.xhtml": xhtml("Chapter One", "First."),
            "OEBPS/b.xhtml": xhtml("Chapter Two", "Second.")
        });
        const parsed = await parseManuscript("spineless.epub", buffer);
        expect(parsed.text).toContain("Chapter One");
        expect(parsed.text).toContain("Chapter Two");
    });

    it("rejects an archive with no container manifest", async () => {
        const buffer = await archive({ "OEBPS/content.opf": opf("Orphan", []) });
        await expect(parseManuscript("broken.epub", buffer)).rejects.toThrow(/Could not read the .epub/);
    });
});

const DOCX_RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Target="word/document.xml"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"/>
</Relationships>`;

const DOCX_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const docxBody = (paragraphs: string[]) => `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
${paragraphs.map(text => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`).join("\n")}
</w:body></w:document>`;

describe("DOCX ingestion", () => {
    it("extracts paragraphs and splits them into chapters", async () => {
        const buffer = await archive({
            "[Content_Types].xml": DOCX_CONTENT_TYPES,
            "_rels/.rels": DOCX_RELS,
            "word/document.xml": docxBody([
                "Chapter One",
                "The gate stood open.",
                "Chapter Two",
                "The steward was lying."
            ])
        });

        const parsed = await parseManuscript("The_Iron_Keep.docx", buffer);
        expect(parsed.title).toBe("The Iron Keep");
        expect(splitIntoChapters(parsed.text)).toEqual([
            { title: "Chapter One", body: "The gate stood open." },
            { title: "Chapter Two", body: "The steward was lying." }
        ]);
    });
});
