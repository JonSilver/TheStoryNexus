import { beforeEach, describe, expect, it } from "vitest";
import type { ChatMessage } from "@/types/story";
import {
    addPending,
    applyOps,
    claimPending,
    clearPending,
    discardUnsaved,
    op,
    readPending,
    readUnsaved,
    removePending
} from "./chatOps";

const msg = (id: string, content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
    id,
    role: id.startsWith("u") ? "user" : "assistant",
    content,
    timestamp: new Date(0),
    ...extra
});

describe("applyOps", () => {
    const base = [msg("u1", "Q1"), msg("a1", "A1")];

    it("puts this device's turn on whatever the server has now — another device's turns stay", () => {
        const server = [...base, msg("u2", "Theirs"), msg("a2", "Their reply")];
        const ops = [
            op({ type: "append", message: msg("u3", "Mine"), after: null }),
            op({ type: "append", message: msg("a3", "My reply"), after: "u3" })
        ];
        expect(applyOps(server, ops).map(m => m.id)).toEqual(["u1", "a1", "u2", "a2", "u3", "a3"]);
    });

    it("a reply goes after the message it answers, even if others arrived since", () => {
        const server = [...base, msg("u3", "Mine"), msg("u4", "Theirs")];
        const ops = [op({ type: "append", message: msg("a3", "My reply"), after: "u3" })];
        expect(applyOps(server, ops).map(m => m.id)).toEqual(["u1", "a1", "u3", "a3", "u4"]);
    });

    it("replaying changes the server already has changes nothing", () => {
        const changes = [
            op({ type: "append", message: msg("u2", "Q2"), after: null }),
            op({ type: "addVersion", messageId: "a1", text: "B", interrupted: false })
        ];
        const once = applyOps(base, changes);
        expect(applyOps(once, changes)).toEqual(once);
        expect(once[1].versions).toEqual(["A1", "B"]);
    });

    it("two regenerations with the same text stay two", () => {
        const merged = applyOps(base, [
            op({ type: "addVersion", messageId: "a1", text: "Same", interrupted: false }),
            op({ type: "addVersion", messageId: "a1", text: "Same", interrupted: true })
        ])[1];
        expect(merged).toMatchObject({ versions: ["A1", "Same", "Same"], shownVersion: 2, interruptedVersions: [2] });
    });

    it("choosing a version is by position, so it means the same version everywhere", () => {
        const two = applyOps(base, [op({ type: "addVersion", messageId: "a1", text: "B", interrupted: false })]);
        const choice = op({
            type: "show",
            messageId: "a1",
            index: 0,
            versionId: null,
            basedOn: two[1].shownBy ?? null
        });
        expect(applyOps(two, [choice])[1]).toMatchObject({ content: "A1", shownVersion: 0 });
    });

    it("a retried choice that already landed never overrides a newer choice made since", () => {
        const regen = op({ type: "addVersion", messageId: "a1", text: "B", interrupted: false });
        const two = applyOps(base, [regen]);
        const mine = op({ type: "show", messageId: "a1", index: 0, versionId: null, basedOn: regen.id });
        const landed = applyOps(two, [mine]);
        const theirs = op({ type: "show", messageId: "a1", index: 1, versionId: null, basedOn: mine.id });
        const newer = applyOps(landed, [theirs]);
        expect(applyOps(newer, [mine])[1]).toMatchObject({ content: "B", shownVersion: 1 });
    });
});

describe("choosing a version", () => {
    it("names the version, so a regeneration saved elsewhere meanwhile can't shift the choice", () => {
        const base = [msg("u1", "Q1"), msg("a1", "A1")];
        const mine = op({ type: "addVersion", messageId: "a1", text: "Mine", interrupted: false });
        const theirs = op({ type: "addVersion", messageId: "a1", text: "Theirs", interrupted: false });
        const choose = op({ type: "show", messageId: "a1", index: 1, versionId: mine.id, basedOn: mine.id });
        // Theirs reached the server first, so mine lands at position 2 — the choice still means mine
        const merged = applyOps(applyOps(base, [theirs]), [mine, choose])[1];
        expect(merged.content).toBe("Mine");
    });
});

describe("pending changes", () => {
    beforeEach(() => {
        // Node has no localStorage: a minimal one, so the device copy is exercised for real
        const store = new Map<string, string>();
        globalThis.localStorage = {
            getItem: (key: string) => store.get(key) ?? null,
            setItem: (key: string, value: string) => void store.set(key, value),
            removeItem: (key: string) => void store.delete(key),
            clear: () => store.clear(),
            key: (index: number) => [...store.keys()][index] ?? null,
            get length() {
                return store.size;
            }
        } as Storage;
        clearPending("c1");
    });

    it("adds and removes by id, so one tab's save never drops another tab's change", () => {
        const mine = op({ type: "show", messageId: "a1", index: 0, versionId: null, basedOn: null });
        const theirs = op({ type: "show", messageId: "a1", index: 1, versionId: null, basedOn: null });
        addPending("c1", [mine]);
        addPending("c1", [theirs]);
        removePending("c1", [mine.id]);
        expect(readPending("c1").map(change => change.id)).toEqual([theirs.id]);
    });

    it("recovers an earlier build's stored lists as changes, regenerations included, with stable ids", () => {
        const before = [msg("u1", "Q1"), msg("a1", "A1")];
        const after = [
            msg("u1", "Q1"),
            msg("a1", "B", { versions: ["A1", "B"], shownVersion: 1, interruptedVersions: [1] }),
            msg("u2", "Q2")
        ];
        localStorage.setItem("storynexus-unsaved-chat:c1", JSON.stringify({ base: before, local: after }));
        const ops = readPending("c1");
        expect(ops.map(change => change.type)).toEqual(["addVersion", "append"]);
        expect(readPending("c1").map(change => change.id)).toEqual(ops.map(change => change.id));
        expect(applyOps(before, ops)[1]).toMatchObject({ versions: ["A1", "B"], interruptedVersions: [1] });
    });

    it("a change another tab is saving is neither unsaved nor discardable meanwhile", () => {
        const saving = op({ type: "show", messageId: "a1", index: 0, versionId: null, basedOn: null });
        const waiting = op({ type: "show", messageId: "a1", index: 1, versionId: null, basedOn: null });
        addPending("c1", [saving, waiting]);
        claimPending("c1", [saving], true);
        expect(readUnsaved("c1").map(change => change.id)).toEqual([waiting.id]);
        discardUnsaved("c1");
        expect(readPending("c1").map(change => change.id)).toEqual([saving.id]);
    });

    it("keeps changes storage couldn't take", () => {
        const kept = op({ type: "show", messageId: "a1", index: 0, versionId: null, basedOn: null });
        const setItem = localStorage.setItem;
        localStorage.setItem = () => {
            throw new Error("QuotaExceededError");
        };
        addPending("c1", [kept]);
        localStorage.setItem = setItem;
        expect(readPending("c1").map(change => change.id)).toEqual([kept.id]);
    });

    it("keeps a choice among several unsaved regenerations when recovering the earlier format", () => {
        const before = [msg("u1", "Q1"), msg("a1", "A1")];
        const after = [msg("u1", "Q1"), msg("a1", "B", { versions: ["A1", "B", "C"], shownVersion: 1 })];
        localStorage.setItem("storynexus-unsaved-chat:c1", JSON.stringify({ base: before, local: after }));
        expect(applyOps(before, readPending("c1"))[1]).toMatchObject({ content: "B", shownVersion: 1 });
    });
});
