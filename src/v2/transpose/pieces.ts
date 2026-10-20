/**
 * A chapter cut into pieces a model can rewrite whole (#77): runs of prose,
 * split at scene breaks and images and kept under a size whose rewrite fits
 * any context window; everything that isn't prose (scene breaks, images)
 * stays exactly as it was. Writing machinery — scene beats and pending
 * suggestions — isn't manuscript, and isn't carried over. Pure, shared by the
 * client (drafting) and the server (rebuilding the chapter on accept), so the
 * two always agree on what the pieces are.
 */
import { attempt } from "@jfdi/attempt";
import { type LexicalNode, parseEditorState } from "../export/blocks.js";
import { blocksToPlainText } from "../export/toPlainText.js";

// A rewrite comes out about as long as its source: ~1,600 tokens each way fits a 16k window with the brief and bible
const PIECE_WORDS = 1200;

type Piece = { kind: "prose"; text: string; words: number } | { kind: "keep"; node: LexicalNode };

const KEEP = new Set(["horizontalrule", "image"]);
const MACHINERY = new Set(["scene-beat", "scene-beat-v2", "suggestion-v2"]);

const wordsIn = (text: string) => text.split(/\s+/).filter(Boolean).length;

const textOf = (node: LexicalNode) => {
    const [, text] = attempt(() => blocksToPlainText(parseEditorState({ root: { type: "root", children: [node] } })));
    return text ?? "";
};

const childrenOf = (content: string): LexicalNode[] => {
    const [, state] = attempt(() => JSON.parse(content) as { root?: LexicalNode });
    return Array.isArray(state?.root?.children) ? state.root.children : [];
};

/** A paragraph too long for one piece, cut between sentences (it comes back as several paragraphs). */
const withinLimit = (text: string, maxWords: number): string[] => {
    if (wordsIn(text) <= maxWords) return [text];
    const sentences = text.match(/[^.!?…]+(?:[.!?…]+["'”’)\]]*\s*|$)/g) ?? [text];
    const parts: string[] = [];
    const part = { text: "", words: 0 };
    for (const sentence of sentences) {
        const words = wordsIn(sentence);
        if (part.words && part.words + words > maxWords) {
            parts.push(part.text.trim());
            part.text = "";
            part.words = 0;
        }
        part.text += sentence;
        part.words += words;
    }
    if (part.text.trim()) parts.push(part.text.trim());
    return parts;
};

export const piecesOf = (content: string, maxWords = PIECE_WORDS): Piece[] => {
    const pieces: Piece[] = [];
    const run = { texts: [] as string[], words: 0 };
    const flush = () => {
        if (run.texts.length) pieces.push({ kind: "prose", text: run.texts.join("\n\n"), words: run.words });
        run.texts = [];
        run.words = 0;
    };
    for (const node of childrenOf(content)) {
        const type = String(node.type ?? "");
        if (MACHINERY.has(type)) continue;
        if (KEEP.has(type)) {
            flush();
            pieces.push({ kind: "keep", node });
            continue;
        }
        const text = textOf(node).trim();
        if (!text) continue;
        for (const part of withinLimit(text, maxWords)) {
            const words = wordsIn(part);
            if (run.words && run.words + words > maxWords) flush();
            run.texts.push(part);
            run.words += words;
        }
    }
    flush();
    return pieces;
};

export const prosePieces = (pieces: Piece[]) =>
    pieces.filter((piece): piece is Extract<Piece, { kind: "prose" }> => piece.kind === "prose");

/** Writing machinery in the chapter that a transposed version won't carry. */
export const machineryIn = (content: string) =>
    childrenOf(content).filter(node => MACHINERY.has(String(node.type ?? ""))).length;

const textNode = (text: string): LexicalNode => ({
    detail: 0,
    format: 0,
    mode: "normal",
    style: "",
    text,
    type: "text",
    version: 1
});

const element = (type: string, children: LexicalNode[], extra: Record<string, unknown> = {}): LexicalNode => ({
    children,
    direction: null,
    format: "",
    indent: 0,
    type,
    version: 1,
    ...extra
});

const SCENE_BREAK = /^\s*(?:(?:\*\s*){3,}|-{3,}|_{3,}|#)\s*$/;

/** A rewritten piece as document nodes: blank lines part paragraphs, single newlines are line breaks. */
const nodesFromText = (text: string): LexicalNode[] =>
    text
        .replace(/\r\n?/g, "\n")
        .split(/\n\s*\n/)
        .map(block => block.trim())
        .filter(Boolean)
        .map(block =>
            SCENE_BREAK.test(block)
                ? { type: "horizontalrule", version: 1 }
                : element(
                      "paragraph",
                      block
                          .split("\n")
                          .flatMap((line, index) =>
                              index === 0 ? [textNode(line)] : [{ type: "linebreak", version: 1 }, textNode(line)]
                          ),
                      { textFormat: 0, textStyle: "" }
                  )
        );

/** The chapter with each prose piece replaced by its rewrite, in order; everything kept stays where it was. */
export const rebuildChapter = (pieces: Piece[], rewrites: string[]): string => {
    const prose = { next: 0 };
    const children = pieces.flatMap(piece =>
        piece.kind === "keep" ? [piece.node] : nodesFromText(rewrites[prose.next++] ?? "")
    );
    return JSON.stringify({ root: element("root", children.length ? children : [element("paragraph", [])]) });
};

export const wordCountOf = (rewrites: string[]) => rewrites.reduce((sum, text) => sum + wordsIn(text), 0);
