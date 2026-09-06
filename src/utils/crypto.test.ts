import { describe, expect, it } from "vitest";
import { randomUUID, uuidV4Fallback } from "./crypto";

const nodeRandom = (bytes: Uint8Array) => {
    crypto.getRandomValues(bytes);
    return bytes;
};

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("uuidV4Fallback", () => {
    it("produces RFC 4122 v4 ids (version and variant bits set)", () => {
        for (const _ of Array.from({ length: 50 })) expect(uuidV4Fallback(nodeRandom)).toMatch(UUID_V4);
    });

    it("forces version/variant even on all-0xff randomness", () => {
        const allOnes = (bytes: Uint8Array) => bytes.fill(0xff);
        expect(uuidV4Fallback(allOnes)).toMatch(UUID_V4);
    });

    it("does not repeat across invocations", () => {
        const ids = new Set(Array.from({ length: 200 }, () => uuidV4Fallback(nodeRandom)));
        expect(ids.size).toBe(200);
    });
});

describe("randomUUID", () => {
    it("returns valid v4 ids on this runtime", () => {
        expect(randomUUID()).toMatch(UUID_V4);
    });
});
