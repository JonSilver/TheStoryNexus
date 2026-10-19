import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/types/story";
import { type ChatOp, applyOps } from "./chatOps";

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
        const ops: ChatOp[] = [
            { type: "append", message: msg("u3", "Mine"), after: null },
            { type: "append", message: msg("a3", "My reply"), after: "u3" }
        ];
        expect(applyOps(server, ops).map(m => m.id)).toEqual(["u1", "a1", "u2", "a2", "u3", "a3"]);
    });

    it("a reply goes after the message it answers, even if others arrived since", () => {
        const server = [...base, msg("u3", "Mine"), msg("u4", "Theirs")];
        const ops: ChatOp[] = [{ type: "append", message: msg("a3", "My reply"), after: "u3" }];
        expect(applyOps(server, ops).map(m => m.id)).toEqual(["u1", "a1", "u3", "a3", "u4"]);
    });

    it("replaying changes the server already has changes nothing", () => {
        const regenerate: ChatOp = { type: "addVersion", messageId: "a1", text: "B", interrupted: false, baseCount: 1 };
        const once = applyOps(base, [{ type: "append", message: msg("u2", "Q2"), after: null }, regenerate]);
        expect(applyOps(once, [{ type: "append", message: msg("u2", "Q2"), after: null }, regenerate])).toEqual(once);
        expect(once[1].versions).toEqual(["A1", "B"]);
    });

    it("both devices regenerating the same reply keeps both versions", () => {
        const theirs = applyOps(base, [
            { type: "addVersion", messageId: "a1", text: "Theirs", interrupted: false, baseCount: 1 }
        ]);
        const merged = applyOps(theirs, [
            { type: "addVersion", messageId: "a1", text: "Mine", interrupted: true, baseCount: 1 }
        ])[1];
        expect(merged.versions).toEqual(["A1", "Theirs", "Mine"]);
        expect(merged).toMatchObject({ content: "Mine", shownVersion: 2, interruptedVersions: [2] });
    });

    it("identical versions stay distinct, by position", () => {
        const twice = applyOps(base, [
            { type: "addVersion", messageId: "a1", text: "A1", interrupted: true, baseCount: 1 }
        ])[1];
        expect(twice).toMatchObject({ versions: ["A1", "A1"], shownVersion: 1, interruptedVersions: [1] });
    });

    it("choosing a version is by position, so it means the same version everywhere", () => {
        const two = applyOps(base, [
            { type: "addVersion", messageId: "a1", text: "B", interrupted: false, baseCount: 1 }
        ]);
        expect(applyOps(two, [{ type: "show", messageId: "a1", index: 0 }])[1]).toMatchObject({
            content: "A1",
            shownVersion: 0
        });
    });
});
