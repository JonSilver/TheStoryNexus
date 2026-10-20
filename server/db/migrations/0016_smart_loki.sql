ALTER TABLE `aiSettings` ADD `favouriteModels` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
UPDATE `aiSettings` SET `favouriteModels` = (
    SELECT json_group_array(json_object('provider', provider, 'modelId', modelId)) FROM (
        SELECT 'local' AS provider, `defaultLocalModel` AS modelId WHERE coalesce(`defaultLocalModel`, '') != ''
        UNION ALL SELECT 'openai', `defaultOpenAIModel` WHERE coalesce(`defaultOpenAIModel`, '') != ''
        UNION ALL SELECT 'openrouter', `defaultOpenRouterModel` WHERE coalesce(`defaultOpenRouterModel`, '') != ''
        UNION ALL SELECT 'gemini', `defaultGeminiModel` WHERE coalesce(`defaultGeminiModel`, '') != ''
    )
);
