/**
 * Hand-written serialised Lexical editor state exercising every v2 block type, every mark
 * combination, both scene-beat extremes, unknown node types and empty paragraphs.
 * Shared by the Markdown, HTML and plain-text specs so the three targets stay in step.
 */
import type { EditorStateJson, LexicalNode } from "./blocks.js";

const text = (value: string, format = 0): LexicalNode => ({
    type: "text",
    version: 1,
    detail: 0,
    format,
    mode: "normal",
    style: "",
    text: value
});

const element = (type: string, children: LexicalNode[], extra: Record<string, unknown> = {}): LexicalNode => ({
    type,
    version: 1,
    direction: "ltr",
    format: "",
    indent: 0,
    children,
    ...extra
});

const paragraph = (children: LexicalNode[]) => element("paragraph", children, { textFormat: 0 });
const heading = (tag: string, children: LexicalNode[]) => element("heading", children, { tag });
const item = (children: LexicalNode[], value = 1) => element("listitem", children, { value, checked: undefined });

const list = (listType: "bullet" | "number", children: LexicalNode[], start = 1) =>
    element("list", children, { listType, start, tag: listType === "number" ? "ol" : "ul" });

/** Every mark combination reachable from bold(1) | italic(2) | underline(8). */
export const MARK_COMBINATIONS: readonly { label: string; format: number }[] = [
    { label: "plain", format: 0 },
    { label: "bold", format: 1 },
    { label: "italic", format: 2 },
    { label: "underline", format: 8 },
    { label: "bold italic", format: 3 },
    { label: "bold underline", format: 9 },
    { label: "italic underline", format: 10 },
    { label: "all three", format: 11 }
];

const markRuns = MARK_COMBINATIONS.flatMap(({ label, format }, index) =>
    index === 0 ? [text(label, format)] : [text(" "), text(label, format)]
);

export const kitchenSinkState: EditorStateJson = {
    root: element("root", [
        heading("h1", [text("The Iron Keep")]),
        heading("h2", [text("Chapter "), text("Two", 1)]),
        heading("h3", [text("Aftermath")]),
        // §1 caps headings at level 3; h4 clamps rather than vanishing.
        heading("h4", [text("Too Deep")]),
        paragraph(markRuns),
        paragraph([text('He said "don\'t" — a_b, *star*, [bracket], `tick`, back\\slash and issue #5.')]),
        paragraph([text("#hashtag opens the line")]),
        paragraph([]),
        paragraph([text("")]),
        paragraph([text("First line"), { type: "linebreak", version: 1 }, text("second line")]),
        paragraph([text("Before"), { type: "tab", version: 1 }, text("after")]),
        paragraph([element("link", [text("linked "), text("prose", 2)], { url: "https://example.com" })]),
        list("bullet", [
            item([text("Alpha")]),
            item([list("bullet", [item([text("Alpha nested")])])]),
            item([paragraph([text("Beta "), text("bold", 1)])])
        ]),
        list("number", [
            item([text("First")]),
            item([list("number", [item([text("Nested one")]), item([text("Nested two")], 2)])]),
            item([text("Second")], 2)
        ]),
        list("number", [item([text("Third")]), item([text("Fourth")], 2)], 3),
        element("horizontalrule", []),
        { type: "image", version: 1, src: "/api/assets/s1/keep.png", altText: "A keep at dusk" },
        {
            type: "image",
            version: 1,
            src: "/api/assets/s1/ash (2).png",
            alt: "Ash & <Mara>",
            caption: 'Ash & Mara at the "gate"'
        },
        { type: "image", version: 1, altText: "no source, dropped" },
        {
            type: "scene-beat",
            version: 1,
            command: "Mara confronts the steward about the missing ledger.",
            status: "done",
            generatedText: "Mara set the ledger down and waited for him to lie.",
            collapsed: true,
            povCharacter: "Mara",
            povType: "First Person"
        },
        { type: "scene-beat", version: 1 },
        element("quote", [text("An unknown block keeps its "), text("prose", 1)]),
        element("custom-callout", [paragraph([text("Nested unknown prose")])])
    ])
};

export const kitchenSinkJson = JSON.stringify(kitchenSinkState);

export const emptyDocumentState: EditorStateJson = { root: element("root", [paragraph([])]) };

export const sceneBeatOnlyState: EditorStateJson = {
    root: element("root", [
        { type: "scene-beat", version: 1, command: "Idle beat", status: "idle" },
        { type: "scene-beat", version: 1, command: "Streaming", status: "generating", generatedText: "half a sen" },
        { type: "scene-beat", version: 1, command: "Finished", status: "done", generatedText: "A whole sentence." }
    ])
};
