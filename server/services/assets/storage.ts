/**
 * Image asset storage on disk (v2 contracts §4).
 * Assets live at {dataDir}/assets/{storyId}/{uuid}.{ext}; the data dir mirrors
 * the DB location (DATABASE_PATH's directory, else ./data). Every path segment
 * that reaches the filesystem is validated here, so callers can never smuggle
 * traversal through a story id or filename.
 */
import { attemptPromise } from "@jfdi/attempt";
import fs from "node:fs/promises";
import path from "node:path";

export const IMAGE_CONTENT_TYPES = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    avif: "image/avif"
} as const;

export type ImageExtension = keyof typeof IMAGE_CONTENT_TYPES;

export const MAX_ASSET_BYTES = 10 * 1024 * 1024;

const EXTENSIONS = Object.keys(IMAGE_CONTENT_TYPES) as ImageExtension[];

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,128}$/;

const ASSET_FILENAME = new RegExp(
    `^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${EXTENSIONS.join("|")})$`
);

const isImageExtension = (ext: string): ext is ImageExtension => ext in IMAGE_CONTENT_TYPES;

const databasePath = (): string => process.env.DATABASE_PATH || path.join(process.cwd(), "data", "storynexus.db");

export const resolveAssetsRoot = (): string => path.join(path.dirname(databasePath()), "assets");

export const isSafeStoryId = (storyId: string): boolean => SAFE_SEGMENT.test(storyId);

/** Absolute directory for a story's assets, or null when the id is unsafe. */
export const resolveStoryDir = (storyId: string): string | null =>
    isSafeStoryId(storyId) ? path.join(resolveAssetsRoot(), storyId) : null;

export const isAssetFilename = (filename: string): boolean => ASSET_FILENAME.test(filename);

/** Absolute path to one stored asset, or null when either segment is unsafe. */
export const resolveAssetPath = (storyId: string, filename: string): string | null => {
    const dir = resolveStoryDir(storyId);
    return dir && isAssetFilename(filename) ? path.join(dir, filename) : null;
};

const imageExtension = (name: string): ImageExtension | null => {
    const ext = path.extname(path.basename(name)).slice(1).toLowerCase();
    return isImageExtension(ext) ? ext : null;
};

export const isSupportedImageName = (originalName: string): boolean => imageExtension(originalName) !== null;

export const assetContentType = (filename: string): string | null => {
    const ext = imageExtension(filename);
    return ext ? IMAGE_CONTENT_TYPES[ext] : null;
};

/**
 * Fresh storage name derived only from the original file's extension — the rest
 * of the client-supplied name (directories, dots, control characters) is discarded.
 * Null when the extension is not a whitelisted image type.
 */
export const assetFilename = (originalName: string): string | null => {
    const ext = imageExtension(originalName);
    return ext ? `${crypto.randomUUID()}.${ext}` : null;
};

export const assetUrl = (storyId: string, filename: string): string => `/api/assets/${storyId}/${filename}`;

export const ensureStoryDir = async (storyId: string): Promise<string | null> => {
    const dir = resolveStoryDir(storyId);
    if (!dir) return null;
    await fs.mkdir(dir, { recursive: true });
    return dir;
};

export const listStoryAssets = async (storyId: string): Promise<string[]> => {
    const dir = resolveStoryDir(storyId);
    if (!dir) return [];
    const [error, entries] = await attemptPromise(() => fs.readdir(dir));
    return error ? [] : entries.filter(isAssetFilename).sort();
};

/** Removes the story's asset directory. Returns how many assets went with it. */
export const deleteStoryAssets = async (storyId: string): Promise<number> => {
    const dir = resolveStoryDir(storyId);
    if (!dir) return 0;
    const count = (await listStoryAssets(storyId)).length;
    await fs.rm(dir, { recursive: true, force: true });
    return count;
};

/** Every asset of a story, base64-encoded, for embedding in a JSON backup. */
export const readStoryAssets = async (storyId: string): Promise<Array<{ filename: string; data: string }>> => {
    const dir = resolveStoryDir(storyId);
    if (!dir) return [];
    const filenames = await listStoryAssets(storyId);
    return Promise.all(
        filenames.map(async filename => ({
            filename,
            data: (await fs.readFile(path.join(dir, filename))).toString("base64")
        }))
    );
};

/**
 * Restores backed-up assets into a story's directory. Filenames are
 * re-validated (a backup is untrusted input) and oversized files skipped;
 * returns the filenames that could NOT be written so the caller can say so.
 */
export const writeStoryAssets = async (
    storyId: string,
    assets: Array<{ filename: string; data: string }>
): Promise<string[]> => {
    if (assets.length === 0) return [];
    const dir = await ensureStoryDir(storyId);
    if (!dir) return assets.map(asset => asset.filename);
    const failed: string[] = [];
    for (const asset of assets) {
        const target = resolveAssetPath(storyId, asset.filename);
        const bytes = typeof asset.data === "string" ? Buffer.from(asset.data, "base64") : null;
        if (!target || !bytes || bytes.length === 0 || bytes.length > MAX_ASSET_BYTES) {
            failed.push(String(asset.filename));
            continue;
        }
        const [error] = await attemptPromise(() => fs.writeFile(target, bytes));
        if (error) failed.push(asset.filename);
    }
    return failed;
};
