import { attemptPromise } from "@jfdi/attempt";
import express from "express";
import multer from "multer";
import fs from "node:fs/promises";
import {
    MAX_ASSET_BYTES,
    assetContentType,
    assetFilename,
    assetUrl,
    deleteStoryAssets,
    ensureStoryDir,
    isSafeStoryId,
    isSupportedImageName,
    resolveAssetPath
} from "../services/assets/storage.js";

const router = express.Router();

const UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE";
const INVALID_STORY_ID = "INVALID_STORY_ID";

const uploadFailures: Record<string, { status: number; error: string }> = {
    LIMIT_FILE_SIZE: { status: 413, error: "Image exceeds the 10 MB limit" },
    [UNSUPPORTED_MEDIA_TYPE]: { status: 415, error: "Only png, jpg, jpeg, gif, webp and avif images are accepted" },
    [INVALID_STORY_ID]: { status: 400, error: "Invalid story id" }
};

const uploadRejection = (code: string) => Object.assign(new Error(code), { code });

const failureFor = (error: Error) => uploadFailures[(error as { code?: string }).code ?? ""];

const asyncHandler =
    (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    async (req: express.Request, res: express.Response) => {
        const [error] = await attemptPromise(() => fn(req, res));
        if (error) {
            console.error("Asset error:", error);
            res.status(500).json({ error: error.message || "Server error" });
        }
    };

const upload = multer({
    limits: { fileSize: MAX_ASSET_BYTES, files: 1 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("image/") && isSupportedImageName(file.originalname)) cb(null, true);
        else cb(uploadRejection(UNSUPPORTED_MEDIA_TYPE));
    },
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            attemptPromise(() => ensureStoryDir(req.params.storyId)).then(([error, dir]) => {
                if (error) cb(error, "");
                else if (dir) cb(null, dir);
                else cb(uploadRejection(INVALID_STORY_ID), "");
            });
        },
        filename: (_req, file, cb) => {
            const filename = assetFilename(file.originalname);
            if (filename) cb(null, filename);
            else cb(uploadRejection(UNSUPPORTED_MEDIA_TYPE), "");
        }
    })
});

const receiveUpload = (req: express.Request, res: express.Response) =>
    new Promise<void>((resolve, reject) => {
        upload.single("file")(req, res, (error?: unknown) => (error ? reject(error) : resolve()));
    });

router.post(
    "/:storyId",
    asyncHandler(async (req, res) => {
        const { storyId } = req.params;
        if (!isSafeStoryId(storyId)) {
            res.status(400).json({ error: "Invalid story id" });
            return;
        }

        const [error] = await attemptPromise(() => receiveUpload(req, res));
        if (error) {
            const failure = failureFor(error);
            res.status(failure?.status ?? 400).json({ error: failure?.error ?? error.message });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        res.status(201).json({ url: assetUrl(storyId, req.file.filename) });
    })
);

router.get(
    "/:storyId/:filename",
    asyncHandler(async (req, res) => {
        const { storyId, filename } = req.params;
        const filePath = resolveAssetPath(storyId, filename);
        const contentType = assetContentType(filename);

        const [error, stats] = filePath ? await attemptPromise(() => fs.stat(filePath)) : [null, null];
        if (!filePath || !contentType || error || !stats?.isFile()) {
            res.status(404).json({ error: "Asset not found" });
            return;
        }

        // Names are content-addressed by uuid, so a stored asset never changes
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        res.sendFile(filePath);
    })
);

router.delete(
    "/:storyId",
    asyncHandler(async (req, res) => {
        const { storyId } = req.params;
        if (!isSafeStoryId(storyId)) {
            res.status(400).json({ error: "Invalid story id" });
            return;
        }
        res.json({ deleted: await deleteStoryAssets(storyId) });
    })
);

export default router;
