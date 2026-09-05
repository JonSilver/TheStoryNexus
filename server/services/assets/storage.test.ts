import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
    assetContentType,
    assetFilename,
    assetUrl,
    deleteStoryAssets,
    ensureStoryDir,
    isAssetFilename,
    isSafeStoryId,
    listStoryAssets,
    resolveAssetPath,
    resolveAssetsRoot,
    resolveStoryDir
} from "./storage.js";

const originalDatabasePath = process.env.DATABASE_PATH;
let tmpDir: string;

beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "storynexus-assets-"));
    process.env.DATABASE_PATH = path.join(tmpDir, "storynexus.db");
});

afterAll(async () => {
    process.env.DATABASE_PATH = originalDatabasePath;
    await fs.rm(tmpDir, { recursive: true, force: true });
});

afterEach(async () => {
    await fs.rm(path.join(tmpDir, "assets"), { recursive: true, force: true });
});

const uuidName = /^[0-9a-f-]{36}\.[a-z]+$/;

describe("resolveAssetsRoot", () => {
    it("sits beside the database file", () => {
        expect(resolveAssetsRoot()).toBe(path.join(tmpDir, "assets"));
    });

    it("falls back to ./data when DATABASE_PATH is unset", () => {
        delete process.env.DATABASE_PATH;
        expect(resolveAssetsRoot()).toBe(path.join(process.cwd(), "data", "assets"));
        process.env.DATABASE_PATH = path.join(tmpDir, "storynexus.db");
    });
});

describe("resolveStoryDir", () => {
    it("nests the story id under the assets root", () => {
        expect(resolveStoryDir("story-1")).toBe(path.join(tmpDir, "assets", "story-1"));
    });

    it.each(["../other", "a/b", "..", ".", "", "story id", "story\0"])("rejects %j", storyId => {
        expect(isSafeStoryId(storyId)).toBe(false);
        expect(resolveStoryDir(storyId)).toBeNull();
    });
});

describe("assetFilename", () => {
    it.each(["png", "jpg", "jpeg", "gif", "webp", "avif"])("accepts .%s", ext => {
        const name = assetFilename(`photo.${ext}`);
        expect(name).toMatch(uuidName);
        expect(name?.endsWith(`.${ext}`)).toBe(true);
    });

    it("lowercases the extension", () => {
        expect(assetFilename("PHOTO.PNG")?.endsWith(".png")).toBe(true);
    });

    it.each(["a.exe", "script.svg", "payload.php", "archive.zip", "noextension", "trailing.", ".png"])(
        "rejects %j",
        original => {
            expect(assetFilename(original)).toBeNull();
        }
    );

    it("discards any path in the original name", () => {
        const traversals = ["../x.png", "../../../etc/passwd.png", "/abs/x.png", "dir/x.png"];
        traversals.forEach(original => {
            const name = assetFilename(original);
            expect(name).toMatch(uuidName);
            expect(name).not.toContain("/");
            expect(name).not.toContain("..");
        });
    });

    it("generates a distinct name per call", () => {
        expect(assetFilename("a.png")).not.toBe(assetFilename("a.png"));
    });
});

describe("isAssetFilename", () => {
    it("accepts a generated name", () => {
        expect(isAssetFilename(assetFilename("a.webp") as string)).toBe(true);
    });

    it.each([
        "../11111111-1111-1111-1111-111111111111.png",
        "sub/11111111-1111-1111-1111-111111111111.png",
        "11111111-1111-1111-1111-111111111111.exe",
        "11111111-1111-1111-1111-111111111111.png.exe",
        "not-a-uuid.png",
        "11111111-1111-1111-1111-111111111111",
        ".."
    ])("rejects %j", filename => {
        expect(isAssetFilename(filename)).toBe(false);
        expect(resolveAssetPath("story-1", filename)).toBeNull();
    });
});

describe("resolveAssetPath", () => {
    it("joins a safe story id and filename", () => {
        const filename = assetFilename("a.gif") as string;
        expect(resolveAssetPath("story-1", filename)).toBe(path.join(tmpDir, "assets", "story-1", filename));
    });

    it("rejects an unsafe story id even with a valid filename", () => {
        expect(resolveAssetPath("../escape", assetFilename("a.gif") as string)).toBeNull();
    });
});

describe("assetContentType", () => {
    it.each([
        ["a.png", "image/png"],
        ["a.jpg", "image/jpeg"],
        ["a.jpeg", "image/jpeg"],
        ["a.gif", "image/gif"],
        ["a.webp", "image/webp"],
        ["a.avif", "image/avif"],
        ["a.AVIF", "image/avif"]
    ])("maps %s", (filename, expected) => {
        expect(assetContentType(filename)).toBe(expected);
    });

    it("returns null for non-images", () => {
        expect(assetContentType("a.exe")).toBeNull();
    });
});

describe("assetUrl", () => {
    it("is the served relative URL", () => {
        expect(assetUrl("story-1", "abc.png")).toBe("/api/assets/story-1/abc.png");
    });
});

describe("directory lifecycle", () => {
    const writeAsset = async (storyId: string, original: string) => {
        const dir = (await ensureStoryDir(storyId)) as string;
        const filename = assetFilename(original) as string;
        await fs.writeFile(path.join(dir, filename), "x");
        return filename;
    };

    it("creates the story dir recursively", async () => {
        const dir = await ensureStoryDir("story-1");
        expect(dir).toBe(path.join(tmpDir, "assets", "story-1"));
        await expect(fs.stat(dir as string)).resolves.toBeTruthy();
    });

    it("refuses to create a dir for an unsafe story id", async () => {
        expect(await ensureStoryDir("../escape")).toBeNull();
    });

    it("lists only well-formed asset filenames, sorted", async () => {
        const names = [await writeAsset("story-1", "a.png"), await writeAsset("story-1", "b.webp")];
        await fs.writeFile(path.join(tmpDir, "assets", "story-1", "stray.txt"), "x");
        expect(await listStoryAssets("story-1")).toEqual(names.sort());
    });

    it("lists nothing for a missing or unsafe story", async () => {
        expect(await listStoryAssets("story-unknown")).toEqual([]);
        expect(await listStoryAssets("../escape")).toEqual([]);
    });

    it("deletes the story dir and reports the asset count", async () => {
        await writeAsset("story-1", "a.png");
        await writeAsset("story-1", "b.png");
        await writeAsset("story-2", "c.png");

        expect(await deleteStoryAssets("story-1")).toBe(2);
        await expect(fs.stat(path.join(tmpDir, "assets", "story-1"))).rejects.toThrow();
        expect(await listStoryAssets("story-2")).toHaveLength(1);
    });

    it("deletes nothing for a missing or unsafe story", async () => {
        expect(await deleteStoryAssets("story-unknown")).toBe(0);
        await writeAsset("story-1", "a.png");
        expect(await deleteStoryAssets("../story-1")).toBe(0);
        expect(await listStoryAssets("story-1")).toHaveLength(1);
    });
});
