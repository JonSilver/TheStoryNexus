import { describe, expect, it } from "vitest";
import { parseEditorState, parseSerialisedDocument } from "./blocks.js";
import { emptyDocumentState, kitchenSinkJson, sceneBeatOnlyState } from "./fixtures.js";
import { blocksToHtml, escapeHtmlAttribute, escapeHtmlText } from "./toHtml.js";

const html = blocksToHtml(parseSerialisedDocument(kitchenSinkJson));

const render = (children: Record<string, unknown>[]) =>
    blocksToHtml(parseEditorState({ root: { type: "root", children } }));

const textNode = (text: string, format = 0) => ({ type: "text", text, format });

const EXPECTED = [
    "<h1>The Iron Keep</h1>",
    "<h2>Chapter <strong>Two</strong></h2>",
    "<h3>Aftermath</h3>",
    "<h3>Too Deep</h3>",
    "<p>plain <strong>bold</strong> <em>italic</em> <u>underline</u> <strong><em>bold italic</em></strong> <strong><u>bold underline</u></strong> <em><u>italic underline</u></em> <strong><em><u>all three</u></em></strong></p>",
    '<p>He said "don\'t" — a_b, *star*, [bracket], `tick`, back\\slash and issue #5.</p>',
    "<p>#hashtag opens the line</p>",
    "<p>First line<br />second line</p>",
    "<p>Before\tafter</p>",
    "<p>linked <em>prose</em></p>",
    "<ul>",
    "    <li>Alpha</li>",
    "    <li>",
    "        <ul>",
    "            <li>Alpha nested</li>",
    "        </ul>",
    "    </li>",
    "    <li>Beta <strong>bold</strong></li>",
    "</ul>",
    "<ol>",
    "    <li>First</li>",
    "    <li>",
    "        <ol>",
    "            <li>Nested one</li>",
    "            <li>Nested two</li>",
    "        </ol>",
    "    </li>",
    "    <li>Second</li>",
    "</ol>",
    '<ol start="3">',
    "    <li>Third</li>",
    "    <li>Fourth</li>",
    "</ol>",
    "<hr />",
    '<img src="/api/assets/s1/keep.png" alt="A keep at dusk" />',
    "<figure>",
    '    <img src="/api/assets/s1/ash (2).png" alt="Ash &amp; &lt;Mara&gt;" />',
    '    <figcaption>Ash &amp; Mara at the "gate"</figcaption>',
    "</figure>",
    "<p>An unknown block keeps its <strong>prose</strong></p>",
    "<p>Nested unknown prose</p>"
].join("\n");

describe("blocksToHtml", () => {
    it("renders the whole fixture document exactly", () => {
        expect(html).toBe(EXPECTED);
    });

    it("renders headings as h1-h3 elements, not the h-tag string", () => {
        const headings = ["h1", "h2", "h3", "h4"].map(tag =>
            render([{ type: "heading", tag, children: [textNode("Title")] }])
        );
        expect(headings).toEqual(["<h1>Title</h1>", "<h2>Title</h2>", "<h3>Title</h3>", "<h3>Title</h3>"]);
        expect(html).not.toMatch(/NaN|undefined/);
    });

    it("emits nothing for scene beats in any status", () => {
        expect(blocksToHtml(parseEditorState(sceneBeatOnlyState))).toBe("");
    });

    it("emits nothing for an empty document", () => {
        expect(blocksToHtml(parseEditorState(emptyDocumentState))).toBe("");
    });

    it("escapes markup in text content", () => {
        const injected = '<script>alert("x")</script> & more';
        expect(render([{ type: "paragraph", children: [textNode(injected)] }])).toBe(
            '<p>&lt;script&gt;alert("x")&lt;/script&gt; &amp; more</p>'
        );
    });

    it("escapes quotes in attribute values so no src or alt can break out", () => {
        const image = {
            type: "image",
            src: '/api/assets/s1/x".png',
            alt: `a " and an ' and <b> & more`,
            caption: "<em>cap</em>"
        };
        expect(render([image])).toBe(
            [
                "<figure>",
                '    <img src="/api/assets/s1/x&quot;.png" alt="a &quot; and an &#39; and &lt;b&gt; &amp; more" />',
                "    <figcaption>&lt;em&gt;cap&lt;/em&gt;</figcaption>",
                "</figure>"
            ].join("\n")
        );
    });

    it("degrades an unknown block to a paragraph of its inline text", () => {
        const children = [{ type: "quote", children: [textNode("kept "), textNode("prose", 2)] }];
        expect(render(children)).toBe("<p>kept <em>prose</em></p>");
    });
});

describe("escapers", () => {
    it("escapes the markup characters in text and adds quote characters for attributes", () => {
        expect(escapeHtmlText(`& < > " '`)).toBe(`&amp; &lt; &gt; " '`);
        expect(escapeHtmlAttribute(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;");
    });

    it("escapes ampersands once, never double-encoding", () => {
        expect(escapeHtmlText("&amp;")).toBe("&amp;amp;");
    });
});
