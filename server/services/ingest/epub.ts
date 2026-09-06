/**
 * EPUB -> plain text (Phase 7 manuscript ingestion).
 *
 * Reads the OPF named by META-INF/container.xml, walks the spine in reading order and
 * concatenates the prose of each XHTML document. Non-linear items (ncx, images, css)
 * are ignored; a spine-less or malformed package falls back to every XHTML entry in
 * archive order rather than failing the import.
 */
import JSZip from "jszip";
import path from "node:path";
import { attributesOf, openingTags, tagText, xhtmlToText } from "./xml.js";

type Zip = Awaited<ReturnType<typeof JSZip.loadAsync>>;

const XHTML_MEDIA_TYPES = ["application/xhtml+xml", "text/html", "application/xml"];

const XHTML_NAME = /\.x?html?$/i;

// Decompression is streamed against a budget: JSZip exposes no uncompressed
// size up front, so the only zip-bomb guard that works is aborting mid-stream
export const MAX_EXPANDED_ENTRY_BYTES = 8 * 1024 * 1024;

const readText = (zip: Zip, entryPath: string, budget = { remaining: MAX_EXPANDED_ENTRY_BYTES }): Promise<string> => {
    const file = zip.file(entryPath);
    if (!file) return Promise.reject(new Error(`Missing EPUB entry: ${entryPath}`));
    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        const stream = file.nodeStream();
        stream.on("data", (chunk: Buffer) => {
            budget.remaining -= chunk.length;
            if (budget.remaining < 0) {
                stream.pause();
                reject(new Error("EPUB content exceeds the expansion limit"));
                return;
            }
            chunks.push(chunk);
        });
        stream.on("error", reject);
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
        stream.resume();
    });
};

/** Hrefs are OPF-relative, URL-encoded and may carry a fragment. */
const resolveHref = (baseDir: string, href: string): string =>
    path.posix.normalize(path.posix.join(baseDir, decodeURIComponent(href.split("#")[0])));

const opfPathOf = (containerXml: string): string => {
    const rootfile = openingTags(containerXml, "rootfile")[0];
    const fullPath = rootfile ? attributesOf(rootfile)["full-path"] : "";
    if (!fullPath) throw new Error("No rootfile in META-INF/container.xml");
    return fullPath;
};

const spinePaths = (opf: string, baseDir: string): string[] => {
    const manifest = new Map(
        openingTags(opf, "item")
            .map(attributesOf)
            .filter(item => item.id && item.href)
            .map(item => [item.id, item] as const)
    );
    return openingTags(opf, "itemref")
        .map(attributesOf)
        .map(ref => manifest.get(ref.idref))
        .filter((item): item is Record<string, string> => item !== undefined)
        .filter(item => XHTML_MEDIA_TYPES.includes(item["media-type"] ?? "") || XHTML_NAME.test(item.href))
        .map(item => resolveHref(baseDir, item.href));
};

const archiveXhtmlPaths = (zip: Zip): string[] =>
    Object.keys(zip.files)
        .filter(name => XHTML_NAME.test(name) && !zip.files[name].dir && !name.startsWith("META-INF/"))
        .sort();

export const parseEpub = async (buffer: Buffer): Promise<{ title: string; text: string }> => {
    const zip = await JSZip.loadAsync(buffer);
    const opfPath = opfPathOf(await readText(zip, "META-INF/container.xml"));
    const opf = await readText(zip, opfPath);
    const baseDir = path.posix.dirname(opfPath);

    const candidates = spinePaths(opf, baseDir).filter(entry => zip.file(entry) !== null);
    const documents = candidates.length > 0 ? candidates : archiveXhtmlPaths(zip);

    // Sequential with one shared budget across the whole spine: peak memory
    // stays bounded and a crafted archive aborts instead of exhausting the
    // process (32 MB expanded is far beyond any real manuscript)
    const spineBudget = { remaining: 32 * 1024 * 1024 };
    const sections: string[] = [];
    for (const entry of documents) sections.push(xhtmlToText(await readText(zip, entry, spineBudget)));

    return { title: tagText(opf, "title"), text: sections.filter(section => section.length > 0).join("\n\n") };
};
