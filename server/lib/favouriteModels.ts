import { z } from "zod";

const PROVIDERS = ["openai", "openrouter", "gemini", "local"] as const;

export const favouriteModelsSchema = z
    .array(z.object({ provider: z.enum(PROVIDERS), modelId: z.string().min(1).max(500) }))
    .max(500);

export type FavouriteModel = z.infer<typeof favouriteModelsSchema>[number];

const LEGACY_DEFAULT_FIELDS = {
    local: "defaultLocalModel",
    openai: "defaultOpenAIModel",
    openrouter: "defaultOpenRouterModel",
    gemini: "defaultGeminiModel"
} as const;

/**
 * A backup made before favourites existed carries per-provider default models;
 * each becomes a favourite, as migration 0016 does for the live database.
 */
export const favouritesFromLegacy = (row: Record<string, unknown>): FavouriteModel[] => {
    const current = favouriteModelsSchema.safeParse(row.favouriteModels);
    if (current.success && current.data.length > 0) return current.data;
    return Object.entries(LEGACY_DEFAULT_FIELDS).flatMap(([provider, field]) => {
        const modelId = row[field];
        return typeof modelId === "string" && modelId
            ? [{ provider: provider as FavouriteModel["provider"], modelId }]
            : [];
    });
};
