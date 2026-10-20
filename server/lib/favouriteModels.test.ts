import { describe, expect, it } from "vitest";
import { favouritesFromLegacy } from "./favouriteModels";

describe("favouritesFromLegacy", () => {
    it("turns per-provider defaults from an old backup into favourites", () => {
        expect(
            favouritesFromLegacy({
                defaultLocalModel: "local/qwen",
                defaultOpenAIModel: "",
                defaultGeminiModel: "gemini-2.5-pro"
            })
        ).toEqual([
            { provider: "local", modelId: "local/qwen" },
            { provider: "gemini", modelId: "gemini-2.5-pro" }
        ]);
    });

    it("keeps favourites a newer backup already carries", () => {
        const favourites = [{ provider: "openai", modelId: "gpt-5" }];
        expect(favouritesFromLegacy({ favouriteModels: favourites, defaultLocalModel: "local/qwen" })).toEqual(
            favourites
        );
    });

    it("is empty when there is nothing to carry over", () => {
        expect(favouritesFromLegacy({ favouriteModels: "not a list" })).toEqual([]);
    });
});
