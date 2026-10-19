import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { pathFor, type V2Tool } from "../../v2/routing";

/**
 * Keeps the in-app guide honest (SOP 9). The guide drifted for weeks while
 * the app changed under it; these checks fail the gate when a link points
 * nowhere or a button the guide tells the writer to press no longer exists.
 */

const root = path.resolve(__dirname, "../../..");
const guideDir = path.join(root, "src/features/guide/content");
const guide = fs
    .readdirSync(guideDir)
    .filter(f => f.endsWith(".mdx"))
    .map(f => fs.readFileSync(path.join(guideDir, f), "utf8"))
    .join("\n");

const sourceFiles = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : [];
    });
const appSource = sourceFiles(path.join(root, "src"))
    .map(f => fs.readFileSync(f, "utf8"))
    .join("\n")
    .replace(/&amp;/g, "&");

/** UI labels the guide tells the writer to look for. */
const LABELS = [
    "Open the library",
    "Switch story",
    "Details, series & voice",
    "Delete this story…",
    "AI providers & models",
    "AI actions (advanced overrides)",
    "Download backup",
    "Refresh chapter summaries automatically",
    "Extract from whole story",
    "Extract from chapter",
    "Extract from pasted text",
    "Scan for updates",
    "Check continuity",
    "Merge duplicates",
    "Merge with AI",
    "Save merged entry",
    "Replace selection",
    "Try again",
    "New take",
    "Accept & tidy",
    "Keep this summary",
    "Download my version",
    "Save as note",
    "To bible",
    "To chapter",
    "Story voice & framing",
    "Import Series",
    "JSON (backup)",
    "Save override",
    "Reset to built-in",
    "Model for this action",
    "Summarise chapter",
    "Add to bible",
    "Refresh Models",
    "Save summary",
    "Scene Beat",
    "Server URL",
    "Look again"
];

const TOOLS: V2Tool[] = [
    "write",
    "brainstorm",
    "story",
    "settings",
    "chapters",
    "bible",
    "library",
    "actions",
    "notes",
    "read",
    "providers",
    "serieslist",
    "guidepage"
];
const STORYLESS_ROUTES = new Set(TOOLS.map(tool => pathFor(tool, null)));

describe("in-app guide", () => {
    it.each(LABELS)("names a control that exists in the app: %s", label => {
        expect(guide, `guide no longer mentions "${label}" — drop it from LABELS`).toContain(label);
        expect(appSource, `the app has no "${label}" — the guide describes something that isn't there`).toContain(
            label
        );
    });

    it("links only to screens that exist", () => {
        const links = [...guide.matchAll(/\]\((\/[^)\s]*)\)/g)].map(match => match[1]);
        expect(links.length).toBeGreaterThan(0);
        for (const link of links) expect(STORYLESS_ROUTES, `guide links to ${link}`).toContain(link);
    });

    it("doesn't describe the retired More screen or the v1 workspace", () => {
        expect(guide).not.toMatch(/\bMore →|\bMore screen|v1 workspace/);
    });
});
