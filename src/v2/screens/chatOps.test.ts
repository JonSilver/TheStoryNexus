import { beforeEach, describe, expect, it } from "vitest";
import type { ChatMessage } from "@/types/story";
import { addPending, applyOps, clearPending, op, readPending, removePending } from "./chatOps";

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
        expect(applyOps(two, [op({ type: "show", messageId: "a1", index: 0 })])[1]).toMatchObject({
            content: "A1",
            shownVersion: 0
        });
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
            key: () => null,
            length: 0
        } as Storage;
        clearPending("c1");
    });

    it("adds and removes by id, so one tab's save never drops another tab's change", () => {
        const mine = op({ type: "show", messageId: "a1", index: 0 });
        const theirs = op({ type: "show", messageId: "a1", index: 1 });
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
});
