import { describe, expect, it } from "vitest";
import { createRunWindow } from "./runWindow.js";

describe("createRunWindow", () => {
    it("allows the limit within the window, then refuses", () => {
        const window = createRunWindow(6, 3_600_000);
        const takes = Array.from({ length: 7 }, (_, i) => window.tryTake(i * 60_000));
        expect(takes).toEqual([true, true, true, true, true, true, false]);
    });

    it("frees a slot as each run ages out of the rolling hour", () => {
        const window = createRunWindow(2, 3_600_000);
        expect(window.tryTake(0)).toBe(true);
        expect(window.tryTake(1_000)).toBe(true);
        expect(window.tryTake(3_599_999)).toBe(false);
        expect(window.tryTake(3_600_000)).toBe(true);
        expect(window.tryTake(3_600_001)).toBe(false);
    });
});
