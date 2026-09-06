/**
 * Uploaded manuscript -> plain text + best-effort title (Phase 7).
 *
 * Extension-routed rather than sniffed by MIME type: the browser's type for .epub and .md
 * is unreliable, and the route already restricts what may be uploaded. Failures carry an
 * HTTP status so the route can distinguish "wrong sort of file" from "server broke".
 */
import { attemptPromise } from "@jfdi/attempt";
import JSZip from "jszip";
import mammoth from "mammoth";
import path from "node:path";
import { parseEpub } from "./epub.js";
import { detectHeadings } from "./split.js";

export interface ParsedManuscript {
    title: string;
    text: string;
}

export const MAX_MANUSCRIPT_BYTES = 20 * 1024 * 1024;

export const SUPPORTED_EXTENSIONS = ["txt", "md", "docx", "epub"] as const;

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number];

type Source = { text: string; title?: string };

/** Errors carrying `ingestStatus` are user-facing; anything else is a 500. */
export const ingestError = (message: string, ingestStatus = 400): Error =>
    Object.assign(new Error(message), { ingestStatus });

export const ingestStatusOf = (error: Error): number | undefined =>
    (error as { ingestStatus?: number }).ingestStatus;

export const extensionOf = (filename: string): string =>
    path.extname(filename).replace(/^\./, "").toLowerCase();

export const isSupportedManuscript = (filename: string): boolean =>
    (SUPPORTED_EXTENSIONS as readonly string[]).includes(extensionOf(filename));

const decodeUtf8 = (buffer: Buffer): string => buffer.toString("utf-8").replace(/^\uFEFF/, "");

const normaliseText = (text: string): string =>
    text
        .replace(/\r\n?/g, "\n")
        .replace(/[\u00a0\u2007\u202f]/g, " ")
        .replace(/[ \t]+$/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

// DOCX is a zip: measure its expanded size (streamed, aborting at the cap)
// BEFORE handing it to mammoth, which offers no expansion bound of its own
const assertZipExpansion = async (buffer: Buffer, capBytes: number): Promise<void> => {
    const [zipError, zip] = await attemptPromise(() => JSZip.loadAsync(buffer));
    if (zipError || !zip) throw ingestError("Could not read the .docx file: not a valid archive", 422);
    const budget = { remaining: capBytes };
    for (const file of Object.values(zip.files)) {
        if (file.dir) continue;
        await new Promise<void>((resolve, reject) => {
            const stream = file.nodeStream();
            stream.on("data", (chunk: Buffer) => {
                budget.remaining -= chunk.length;
                if (budget.remaining < 0) {
                    stream.pause();
                    reject(ingestError("The .docx expands beyond the 64 MB safety limit", 413));
                }
            });
            stream.on("error", () => reject(ingestError("Could not read the .docx file", 422)));
            stream.on("end", () => resolve());
            stream.resume();
        });
    }
};

const readDocx = async (buffer: Buffer): Promise<Source> => {
    await assertZipExpansion(buffer, 64 * 1024 * 1024);
    const [error, result] = await attemptPromise(() => mammoth.extractRawText({ buffer }));
    if (error) throw ingestError(`Could not read the .docx file: ${error.message}`, 422);
    return { text: result.value };
};

const readEpub = async (buffer: Buffer): Promise<Source> => {
    const [error, result] = await attemptPromise(() => parseEpub(buffer));
    if (error) throw ingestError(`Could not read the .epub file: ${error.message}`, 422);
    return result;
};

const PARSERS: Record<SupportedExtension, (buffer: Buffer) => Promise<Source>> = {
    txt: async buffer => ({ text: decodeUtf8(buffer) }),
    md: async buffer => ({ text: decodeUtf8(buffer) }),
    docx: readDocx,
    epub: readEpub
};

const LEADING_H1 = /^[ \t]*#[ \t]+(.+?)[ \t]*#*(?:\n|$)/;

/**
 * A leading `# Title` is the manuscript's title rather than its first chapter only when
 * further headings follow it; otherwise it is left in place for the splitter.
 */
const withLeadingTitle = (text: string): Source => {
    const match = LEADING_H1.exec(text.replace(/^\n+/, ""));
    if (!match) return { text };
    const rest = text.replace(/^\n+/, "").slice(match[0].length);
    return detectHeadings(rest).length > 0 ? { text: rest.trim(), title: match[1].trim() } : { text };
};

const titleFromFilename = (filename: string): string =>
    path
        .basename(filename, path.extname(filename))
        .replace(/[_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

export const parseManuscript = async (filename: string, buffer: Buffer): Promise<ParsedManuscript> => {
    const extension = extensionOf(filename);
    if (!isSupportedManuscript(filename))
        throw ingestError(`Unsupported file type "${extension || filename}". Use .txt, .md, .docx or .epub`, 415);
    if (buffer.length === 0) throw ingestError("The uploaded file is empty");
    if (buffer.length > MAX_MANUSCRIPT_BYTES) throw ingestError("The file exceeds the 20 MB limit", 413);

    const source = await PARSERS[extension as SupportedExtension](buffer);
    const normalised = normaliseText(source.text);
    if (!normalised) throw ingestError("No readable text was found in that file", 422);

    const leading = withLeadingTitle(normalised);
    return {
        title: source.title?.trim() || leading.title || titleFromFilename(filename) || "Imported Manuscript",
        text: leading.text
    };
};

export const parseManuscriptText = (text: string, title?: string): ParsedManuscript => {
    const normalised = normaliseText(text ?? "");
    if (!normalised) throw ingestError("No text was supplied");

    const leading = withLeadingTitle(normalised);
    return { title: title?.trim() || leading.title || "Imported Manuscript", text: leading.text };
};
