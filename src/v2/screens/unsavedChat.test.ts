import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/types/story";
import { mergeUnsaved } from "./unsavedChat";

const msg = (id: string, content: string, extra: Partial<ChatMessage> = {}): ChatMessage => ({
    id,
    role: id.startsWith("u") ? "user" : "assistant",
    content,
    timestamp: new Date(0),
    ...extra
});

describe("mergeUnsaved", () => {
    const base = [msg("u1", "Q1"), msg("a1", "A1")];

    it("puts this device's turns after the message they followed, never reordering the server's", () => {
        const local = [...base, msg("u2", "Q2 here"), msg("a2", "A2 here")];
        const server = [...base, msg("u3", "Q2 elsewhere"), msg("a3", "A2 elsewhere")];
        expect(mergeUnsaved(server, { base, local }).map(m => m.id)).toEqual(["u1", "a1", "u2", "a2", "u3", "a3"]);
    });

    it("appends when the message they followed is gone", () => {
        const local = [...base, msg("u2", "Q2")];
        expect(mergeUnsaved([msg("u9", "Other")], { base, local }).map(m => m.id)).toEqual(["u9", "u2"]);
    });

    it("never replays stale text over a message the server changed", () => {
        const server = [msg("u1", "Q1 corrected"), msg("a1", "A1")];
        const merged = mergeUnsaved(server, { base, local: [...base, msg("u2", "Q2")] });
        expect(merged[0]).toEqual(server[0]);
    });

    it("keeps both devices' regenerations of the same reply", () => {
        const server = [msg("u1", "Q1"), msg("a1", "Theirs", { versions: ["A1", "Theirs"], shownVersion: 1 })];
        const local = [
            msg("u1", "Q1"),
            msg("a1", "Mine", { versions: ["A1", "Mine"], shownVersion: 1, interruptedVersions: [1] })
        ];
        const merged = mergeUnsaved(server, { base, local })[1];
        expect(merged.versions).toEqual(["A1", "Theirs", "Mine"]);
        expect(merged.content).toBe("Mine");
        expect(merged.shownVersion).toBe(2);
        expect(merged.interruptedVersions).toEqual([2]);
    });

    it("keeps identical versions distinct, with their own marks", () => {
        const before = [msg("u1", "Q1"), msg("a1", "Same", { versions: ["Same"] })];
        const local = [
            msg("u1", "Q1"),
            msg("a1", "Same", { versions: ["Same", "Same"], shownVersion: 1, interruptedVersions: [1] })
        ];
        const merged = mergeUnsaved(before, { base: before, local })[1];
        expect(merged.versions).toEqual(["Same", "Same"]);
        expect(merged.shownVersion).toBe(1);
        expect(merged.interruptedVersions).toEqual([1]);
    });

    it("carries this device's choice of version even with nothing new", () => {
        const two = msg("a1", "B", { versions: ["A", "B"], shownVersion: 1 });
        const before = [msg("u1", "Q1"), two];
        const local = [msg("u1", "Q1"), { ...two, content: "A", shownVersion: 0 }];
        const merged = mergeUnsaved(before, { base: before, local })[1];
        expect(merged.content).toBe("A");
        expect(merged.shownVersion).toBe(0);
    });

    it("is exactly the server's conversation when this device has nothing unsaved", () => {
        const server = [...base, msg("u3", "Q3")];
        expect(mergeUnsaved(server, { base, local: base })).toEqual(server);
    });
});
