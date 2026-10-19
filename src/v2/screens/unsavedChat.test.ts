import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/types/story";
import { mergeUnsaved } from "./unsavedChat";

const msg = (id: string, content: string, versions?: string[]): ChatMessage => ({
    id,
    role: id.startsWith("u") ? "user" : "assistant",
    content,
    timestamp: new Date(0),
    ...(versions && { versions })
});

describe("mergeUnsaved", () => {
    it("never drops what another device saved since", () => {
        const base = [msg("u1", "Q1"), msg("a1", "A1")];
        const local = [...base, msg("u2", "Q2 here"), msg("a2", "A2 here")];
        const server = [...base, msg("u3", "Q2 elsewhere"), msg("a3", "A2 elsewhere")];
        expect(mergeUnsaved(server, local).map(m => m.id)).toEqual(["u1", "a1", "u3", "a3", "u2", "a2"]);
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
});
