import { describe, expect, it, vi } from "vitest";
import { createSSEParser } from "./sseParser";

const collect = () => {
    const tokens: string[] = [];
    const onComplete = vi.fn();
    const onError = vi.fn();
    const parser = createSSEParser({ onToken: t => tokens.push(t), onComplete, onError });
    return { tokens, onComplete, onError, parser };
};

describe("createSSEParser", () => {
    it("parses whole frames and completes on finish", () => {
        const { tokens, onComplete, onError, parser } = collect();
        parser.push('event: token\ndata: {"text":"Hello"}\n\nevent: token\ndata: {"text":" world"}\n\n');
        parser.push('event: finish\ndata: {"reason":"complete"}\n\n');
        parser.end();
        expect(tokens).toEqual(["Hello", " world"]);
        expect(onComplete).toHaveBeenCalledOnce();
        expect(onError).not.toHaveBeenCalled();
    });

    it("buffers frames split across chunk boundaries", () => {
        const { tokens, onComplete, parser } = collect();
        parser.push("event: tok");
        parser.push('en\ndata: {"te');
        parser.push('xt":"Hi"}\n\nevent: finish\ndata: {}\n\n');
        parser.end();
        expect(tokens).toEqual(["Hi"]);
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it("tolerates CRLF line endings", () => {
        const { tokens, onComplete, parser } = collect();
        parser.push('event: token\r\ndata: {"text":"Hi"}\r\n\r\nevent: finish\r\ndata: {}\r\n\r\n');
        parser.end();
        expect(tokens).toEqual(["Hi"]);
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it("reports an error when the stream ends without a terminal frame", () => {
        const { tokens, onComplete, onError, parser } = collect();
        parser.push('event: token\ndata: {"text":"Half a stor"}\n\n');
        parser.end();
        expect(tokens).toEqual(["Half a stor"]);
        expect(onComplete).not.toHaveBeenCalled();
        expect(onError).toHaveBeenCalledOnce();
    });

    it("dispatches a terminal frame left unterminated in the buffer at end", () => {
        const { onComplete, onError, parser } = collect();
        parser.push('event: token\ndata: {"text":"x"}\n\nevent: finish\ndata: {}');
        parser.end();
        expect(onComplete).toHaveBeenCalledOnce();
        expect(onError).not.toHaveBeenCalled();
    });

    it("surfaces server error frames", () => {
        const { onComplete, onError, parser } = collect();
        parser.push('event: error\ndata: {"message":"key not set"}\n\n');
        parser.end();
        expect(onError).toHaveBeenCalledWith(new Error("key not set"));
        expect(onComplete).not.toHaveBeenCalled();
    });

    it("aborted counts as completion, not error", () => {
        const { onComplete, onError, parser } = collect();
        parser.push("event: aborted\ndata: {}\n\n");
        parser.end();
        expect(onComplete).toHaveBeenCalledOnce();
        expect(onError).not.toHaveBeenCalled();
    });

    it("ignores frames after termination", () => {
        const { tokens, onComplete, parser } = collect();
        parser.push('event: finish\ndata: {}\n\nevent: token\ndata: {"text":"late"}\n\n');
        parser.end();
        expect(tokens).toEqual([]);
        expect(onComplete).toHaveBeenCalledOnce();
    });

    it("reports status heartbeats without terminating the stream", () => {
        const statuses: Array<{ phase: string; elapsedMs: number }> = [];
        const tokens: string[] = [];
        const onComplete = vi.fn();
        const parser = createSSEParser({
            onStatus: status => statuses.push(status),
            onToken: t => tokens.push(t),
            onComplete,
            onError: vi.fn()
        });
        parser.push('event: status\ndata: {"phase":"waiting","elapsedMs":2000}\n\n');
        parser.push(
            'event: status\ndata: {"phase":"streaming","elapsedMs":4100}\n\nevent: token\ndata: {"text":"Hi"}\n\n'
        );
        parser.push("event: finish\ndata: {}\n\n");
        parser.end();
        expect(statuses).toEqual([
            { phase: "waiting", elapsedMs: 2000 },
            { phase: "streaming", elapsedMs: 4100 }
        ]);
        expect(tokens).toEqual(["Hi"]);
        expect(onComplete).toHaveBeenCalledOnce();
    });
});
