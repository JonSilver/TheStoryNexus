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

const readText = async (zip: Zip, entryPath: string): Promise<string> => {
    const file = zip.file(entryPath);
    if (!file) throw new Error(`Missing EPUB entry: ${entryPath}`);
    return file.async("string");
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

    // Sequential: concurrent expansion of every spine item multiplies peak memory
    const sections: string[] = [];
    for (const entry of documents) sections.push(xhtmlToText(await readText(zip, entry)));

    return { title: tagText(opf, "title"), text: sections.filter(section => section.length > 0).join("\n\n") };
};
