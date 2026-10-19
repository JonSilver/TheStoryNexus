import { describe, expect, it } from "vitest";
import { declaredSizeFailure } from "./ingest.js";

const request = (contentLength?: string) => ({ headers: contentLength ? { "content-length": contentLength } : {} });

describe("declaredSizeFailure (rejects before any upload is buffered)", () => {
    it("accepts a normal multi-file upload", () => {
        expect(declaredSizeFailure(request(String(5 * 1024 * 1024)))).toBeNull();
    });

    it("rejects a request larger than the 60 MB total with 413", () => {
        expect(declaredSizeFailure(request(String(61 * 1024 * 1024)))?.status).toBe(413);
    });

    it("rejects an upload that doesn't declare its size with 411", () => {
        expect(declaredSizeFailure(request())?.status).toBe(411);
        expect(declaredSizeFailure(request("not-a-number"))?.status).toBe(411);
    });
});
