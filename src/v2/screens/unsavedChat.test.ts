import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/types/story";
import { mergeUnsaved } from "./unsavedChat";

const msg = (id: string, content: string, versions?: string[], at = 0): ChatMessage => ({
    id,
    role: id.startsWith("u") ? "user" : "assistant",
    content,
    timestamp: new Date(at),
    ...(versions && { versions })
});

describe("mergeUnsaved", () => {
    it("never drops what another device saved since", () => {
        const base = [msg("u1", "Q1", undefined, 1), msg("a1", "A1", undefined, 2)];
        const local = [...base, msg("u2", "Q2 here", undefined, 3), msg("a2", "A2 here", undefined, 4)];
        const server = [...base, msg("u3", "Q2 elsewhere", undefined, 5), msg("a3", "A2 elsewhere", undefined, 6)];
        // In the order they were written — not one device's turns tacked on after the other's
        expect(mergeUnsaved(server, local).map(m => m.id)).toEqual(["u1", "a1", "u2", "a2", "u3", "a3"]);
    });

    it("keeps a regenerated version this device couldn't save", () => {
        const server = [msg("u1", "Q"), msg("a1", "First")];
        const local = [msg("u1", "Q"), msg("a1", "Second", ["First", "Second"])];
        expect(mergeUnsaved(server, local)[1].versions).toEqual(["First", "Second"]);
    });

    it("is the server's conversation when nothing local is new", () => {
        const server = [msg("u1", "Q"), msg("a1", "A", ["A0", "A"])];
        expect(mergeUnsaved(server, [msg("u1", "Q"), msg("a1", "A0")])).toEqual(server);
    });

    it("loses neither device's regeneration when both regenerated the same reply", () => {
        const server = [msg("u1", "Q"), { ...msg("a1", "Theirs", ["First", "Theirs"]), shownVersion: 1 }];
        const local = [msg("u1", "Q"), { ...msg("a1", "Mine", ["First", "Mine"]), interruptedVersions: [1] }];
        const merged = mergeUnsaved(server, local)[1];
        expect(merged.versions).toEqual(["First", "Theirs", "Mine"]);
        expect(merged.content).toBe("Mine");
        expect(merged.shownVersion).toBe(2);
        expect(merged.interruptedVersions).toEqual([2]);
    });
});
