/**
 * Manuscript ingestion API (Phase 7): analyse -> review on the client -> commit.
 *
 * Analysis never writes to the database; the split is parked under a token so the review
 * step can rename or drop chapters without re-uploading. Commit creates the story and all
 * of its chapters in a single better-sqlite3 transaction — a partial import is worse than
 * no import.
 */
import { attemptPromise } from "@jfdi/attempt";
import express from "express";
import multer from "multer";
import { z } from "zod";
import { countWords } from "../../src/utils/textUtils.js";
import { db, schema } from "../db/client.js";
import {
    MAX_MANUSCRIPT_BYTES,
    ingestStatusOf,
    isSupportedManuscript,
    parseManuscript,
    parseManuscriptText
} from "../services/ingest/parse.js";
import { type SplitChapter, splitIntoChapters } from "../services/ingest/split.js";
import { restoreAnalysis, storeAnalysis, takeAnalysis } from "../services/ingest/store.js";
import { toLexicalDocument } from "../services/ingest/toLexical.js";

const router = express.Router();

const PREVIEW_CHARS = 300;
const UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE";

const MAX_UPLOAD_FILES = 50;

const uploadFailures: Record<string, { status: number; error: string }> = {
    LIMIT_FILE_SIZE: { status: 413, error: "A file exceeds the 20 MB limit" },
    LIMIT_FILE_COUNT: { status: 400, error: `Upload at most ${MAX_UPLOAD_FILES} files` },
    [UNSUPPORTED_MEDIA_TYPE]: { status: 415, error: "Only .txt, .md, .docx and .epub files are accepted" }
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MANUSCRIPT_BYTES, files: MAX_UPLOAD_FILES },
    fileFilter: (_req, file, callback) =>
        isSupportedManuscript(file.originalname)
            ? callback(null, true)
            : callback(Object.assign(new Error(UNSUPPORTED_MEDIA_TYPE), { code: UNSUPPORTED_MEDIA_TYPE }))
});

// One field name, one-or-many files: multi-part stories arrive as separate
// files (a file per chapter or per part), uploaded together in reading order
const receiveUpload = (req: express.Request, res: express.Response) =>
    new Promise<void>((resolve, reject) => {
        upload.array("files", MAX_UPLOAD_FILES)(req, res, (error?: unknown) => (error ? reject(error) : resolve()));
    });

/** User-facing failures answer with their own status; everything else is a genuine 500. */
const asyncHandler =
    (fn: (req: express.Request, res: express.Response) => Promise<void>) =>
    async (req: express.Request, res: express.Response) => {
        const [error] = await attemptPromise(() => fn(req, res));
        if (!error) return;
        const status = ingestStatusOf(error);
        if (!status) console.error("Ingest error:", error);
        res.status(status ?? 500).json({ error: error.message || "Server error" });
    };

// Compressed uploads (docx/epub) can expand far beyond the 20 MB file cap
const MAX_EXPANDED_CHARS = 8_000_000;

const analysisResponse = (res: express.Response, title: string, chapters: SplitChapter[]) => {
    res.json({
        token: storeAnalysis(title, chapters),
        title,
        chapters: chapters.map(chapter => ({
            title: chapter.title,
            wordCount: countWords(chapter.body),
            preview: chapter.body.slice(0, PREVIEW_CHARS)
        }))
    });
};

router.post(
    "/analyse",
    asyncHandler(async (req, res) => {
        const [uploadError] = await attemptPromise(() => receiveUpload(req, res));
        if (uploadError) {
            const failure = uploadFailures[(uploadError as { code?: string }).code ?? ""];
            res.status(failure?.status ?? 400).json({ error: failure?.error ?? uploadError.message });
            return;
        }
        const files = (req.files as Express.Multer.File[] | undefined) ?? [];
        if (files.length === 0) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }

        const parsed = [];
        for (const file of files) parsed.push(await parseManuscript(file.originalname, file.buffer));
        const totalChars = parsed.reduce((sum, p) => sum + p.text.length, 0);
        if (totalChars > MAX_EXPANDED_CHARS) {
            res.status(413).json({ error: "The manuscript is too large after extraction (8M character limit)" });
            return;
        }

        // Each file splits independently; a file that yields a single untitled
        // chapter takes the file's own title (the common chapter-per-file case)
        const chapters = parsed.flatMap(part => {
            const split = splitIntoChapters(part.text);
            return split.length === 1 && /^Chapter \d+$/.test(split[0].title)
                ? [{ ...split[0], title: part.title }]
                : split;
        });
        analysisResponse(res, parsed[0].title, chapters);
    })
);

const pastedSchema = z.object({
    text: z.string().min(1).max(8_000_000),
    title: z.string().max(500).optional()
});

router.post(
    "/analyse-text",
    asyncHandler(async (req, res) => {
        const parsed = pastedSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
            return;
        }
        const manuscript = parseManuscriptText(parsed.data.text, parsed.data.title);
        analysisResponse(res, manuscript.title, splitIntoChapters(manuscript.text));
    })
);

const commitSchema = z.object({
    token: z.string().min(1),
    title: z.string().min(1).max(500),
    author: z.string().max(200).optional(),
    language: z.string().max(100).optional(),
    chapters: z
        .array(z.object({ index: z.number().int().min(0), title: z.string().max(500) }))
        .min(1)
        .max(2000)
});

type CommitChapter = z.infer<typeof commitSchema>["chapters"][number];

const selectChapters = (stored: SplitChapter[], requested: CommitChapter[]): SplitChapter[] => {
    // Duplicate indices would amplify one staged chapter into thousands of rows
    const seen = new Set<number>();
    return requested
        .filter(({ index }) => (seen.has(index) ? false : (seen.add(index), true)))
        .map(({ index, title }) => {
            const source = stored[index];
            if (!source) throw new Error(`Unknown chapter index ${index}`);
            return { title: title.trim() || source.title, body: source.body };
        });
};

router.post(
    "/commit",
    asyncHandler(async (req, res) => {
        const parsed = commitSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ error: "Invalid request", details: parsed.error.issues });
            return;
        }
        const { token, title, author, language, chapters } = parsed.data;

        // Taken atomically (synchronous, pre-await): concurrent commits of the
        // same token cannot both proceed
        const analysis = takeAnalysis(token);
        if (!analysis) {
            res.status(410).json({ error: "That analysis has expired. Upload the manuscript again." });
            return;
        }

        const [selectionError, selected] = await attemptPromise(async () =>
            selectChapters(analysis.chapters, chapters)
        );
        if (selectionError || !selected || selected.length === 0) {
            restoreAnalysis(token, analysis);
            res.status(400).json({ error: selectionError?.message ?? "No chapters selected" });
            return;
        }

        const storyId = crypto.randomUUID();
        const createdAt = new Date();

        const [transactionError] = await attemptPromise(async () =>
            db.transaction(tx => {
                tx.insert(schema.stories)
                    .values({
                        id: storyId,
                        title: title.trim(),
                        author: author?.trim() ?? "",
                        language: language?.trim() || "English",
                        createdAt
                    })
                    .run();
                selected.forEach((chapter, order) => {
                    tx.insert(schema.chapters)
                        .values({
                            id: crypto.randomUUID(),
                            storyId,
                            title: chapter.title,
                            order,
                            content: toLexicalDocument(chapter.body),
                            revision: 0,
                            wordCount: countWords(chapter.body),
                            createdAt,
                            updatedAt: createdAt
                        })
                        .run();
                });
            })
        );
        if (transactionError) {
            restoreAnalysis(token, analysis);
            throw transactionError;
        }

        res.status(201).json({ storyId, chapterCount: selected.length });
    })
);

export default router;
