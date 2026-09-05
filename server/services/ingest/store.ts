/**
 * Short-lived server-side holding pen for analysed manuscripts (Phase 7).
 *
 * The review step needs the full split text, which can be tens of megabytes — round-tripping
 * it through the browser twice is wasteful, so the client holds only a token. Entries expire
 * after 30 minutes and are swept lazily on access, so nothing keeps the process alive.
 */
import type { SplitChapter } from "./split.js";

export interface StoredAnalysis {
    title: string;
    chapters: SplitChapter[];
    expiresAt: number;
}

export const ANALYSIS_TTL_MS = 30 * 60 * 1000;

const MAX_ANALYSES = 20;

const analyses = new Map<string, StoredAnalysis>();

/** Map iteration is insertion-ordered, so the oldest entries are the ones to shed. */
const sweep = (now: number) => {
    [...analyses]
        .filter(([, analysis]) => analysis.expiresAt <= now)
        .forEach(([token]) => analyses.delete(token));
    [...analyses.keys()].slice(0, Math.max(0, analyses.size - MAX_ANALYSES)).forEach(token => analyses.delete(token));
};

export const storeAnalysis = (title: string, chapters: SplitChapter[], now = Date.now()): string => {
    const token = crypto.randomUUID();
    analyses.set(token, { title, chapters, expiresAt: now + ANALYSIS_TTL_MS });
    sweep(now);
    return token;
};

export const getAnalysis = (token: string, now = Date.now()): StoredAnalysis | null => {
    sweep(now);
    return analyses.get(token) ?? null;
};

export const dropAnalysis = (token: string): boolean => analyses.delete(token);
