import { chaptersApi } from "@/services/api/client";
import type { PromptContext, PromptParserConfig } from "@/types/story";

export class ContextBuilder {
    async buildContext(config: PromptParserConfig): Promise<PromptContext> {
        const [chapters, currentChapter] = await Promise.all([
            chaptersApi.getByStory(config.storyId),
            config.chapterId ? chaptersApi.getById(config.chapterId) : Promise.resolve(undefined)
        ]);

        return {
            ...config,
            chapters,
            currentChapter,
            matchedEntries: config.matchedEntries,
            povCharacter: config.povCharacter || currentChapter?.povCharacter,
            povType: config.povType || currentChapter?.povType || "Third Person Omniscient",
            additionalContext: config.additionalContext || {}
        };
    }
}
