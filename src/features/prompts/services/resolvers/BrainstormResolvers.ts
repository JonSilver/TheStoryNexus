import { attemptPromise } from "@jfdi/attempt";
import is from "@sindresorhus/is";
import { fetchAllChapterSummaries, fetchChapterSummary } from "@/features/chapters/hooks/useChapterSummariesQuery";
import { chaptersApi } from "@/services/api/client";
import type { LorebookEntry, PromptContext } from "@/types/story";
import { extractPlainTextFromLexical } from "@/utils/lexicalUtils";
import { logger } from "@/utils/logger";
import type { ILorebookFormatter, IVariableResolver } from "./types";

export class ChatHistoryResolver implements IVariableResolver {
    async resolve(context: PromptContext): Promise<string> {
        const chatHistory = context.additionalContext?.chatHistory as
            | Array<{ role: string; content: string }>
            | undefined;
        if (!chatHistory?.length) return "No previous conversation history.";

        return chatHistory.map(msg => `${msg.role.toUpperCase()}: ${msg.content}`).join("\n\n");
    }
}

export class UserInputResolver implements IVariableResolver {
    async resolve(context: PromptContext): Promise<string> {
        if (!context.scenebeat?.trim()) return "No specific question or topic provided.";

        return context.scenebeat;
    }
}

export class BrainstormContextResolver implements IVariableResolver {
    constructor(
        private formatter: ILorebookFormatter,
        private entries: LorebookEntry[]
    ) {}

    async resolve(context: PromptContext): Promise<string> {
        logger.info("DEBUG: brainstormContext additionalContext:", context.additionalContext);

        if (context.additionalContext?.includeFullContext === true) {
            const chapterSummary = await fetchAllChapterSummaries(context.storyId);
            // Note: No storyId filter needed - hierarchical query already returns correct entries
            const filteredEntries = this.entries.filter(e => !e.isDisabled);

            const parts = [
                chapterSummary ? `Story Chapter Summaries:\n${chapterSummary}` : "",
                filteredEntries.length > 0
                    ? (chapterSummary ? "Story World Information:\n" : "") +
                      this.formatter.formatEntries(filteredEntries)
                    : ""
            ];

            return parts.filter(Boolean).join("\n\n");
        }

        const summaries = await this.getSelectedSummaries(context);
        const chapterContent = await this.getSelectedChapterContent(context);
        const lorebookEntries = this.getSelectedLorebookEntries(context);

        if (!summaries && !chapterContent && !lorebookEntries)
            return "No story context is available for this query. Feel free to ask about anything related to writing or storytelling in general.";

        const parts = [
            summaries ? `Story Chapter Summaries:\n${summaries}` : "",
            chapterContent ? `Full Chapter Content:\n${chapterContent}` : "",
            lorebookEntries ? `Story World Information:\n${lorebookEntries}` : ""
        ];

        return (
            parts.filter(Boolean).join("\n\n") ||
            "No story context is available for this query. Feel free to ask about anything related to writing or storytelling in general."
        );
    }

    private async getSelectedSummaries(context: PromptContext): Promise<string> {
        const selectedSummaries = context.additionalContext?.selectedSummaries;
        if (!selectedSummaries || !is.array(selectedSummaries) || selectedSummaries.length === 0) return "";

        if (selectedSummaries.includes("all")) return await fetchAllChapterSummaries(context.storyId);

        const summaries = await Promise.all((selectedSummaries as string[]).map(id => fetchChapterSummary(id)));
        return summaries.filter(Boolean).join("\n\n");
    }

    private async getSelectedChapterContent(context: PromptContext): Promise<string> {
        const selectedContent = context.additionalContext?.selectedChapterContent;
        if (!selectedContent || !is.array(selectedContent) || selectedContent.length === 0) {
            logger.info("DEBUG: No selectedChapterContent found or empty array");
            return "";
        }

        logger.info("DEBUG: Processing selectedChapterContent:", selectedContent);

        const [error, contents] = await attemptPromise(() =>
            Promise.all(
                (selectedContent as string[]).map(async id => {
                    logger.info(`DEBUG: Fetching content for chapter ID: ${id}`);

                    const [chapterError, chapter] = await attemptPromise(() => chaptersApi.getById(id));

                    if (chapterError) {
                        logger.error(`DEBUG: Error fetching chapter ${id}:`, chapterError);
                        return "";
                    }

                    logger.info(
                        `DEBUG: Chapter fetch result:`,
                        chapter ? `Found chapter ${chapter.order}` : "Not found"
                    );

                    if (!chapter) return "";

                    logger.info(`DEBUG: Getting plain text for chapter ${chapter.order}`);
                    const content = chapter.content ? extractPlainTextFromLexical(chapter.content) : "";

                    logger.info(
                        `DEBUG: Content length for chapter ${chapter.order}: ${content ? content.length : 0} chars`
                    );

                    return content ? `Chapter ${chapter.order} Content:\n${content}` : "";
                })
            )
        );

        if (error) {
            logger.error("DEBUG: Error in chapter content processing:", error);
            return "";
        }

        const contentText = contents.filter(Boolean).join("\n\n");
        logger.info(`DEBUG: Final chapter content text:`, `${contentText.substring(0, 100)}...`);

        if (contentText) logger.info("DEBUG: Added chapter content to result");
        else logger.info("DEBUG: No chapter content was added (empty content)");

        return contentText;
    }

    private getSelectedLorebookEntries(context: PromptContext): string {
        const selectedItems = context.additionalContext?.selectedItems;
        if (!selectedItems || !is.array(selectedItems) || selectedItems.length === 0) return "";

        const selectedItemIds = selectedItems as string[];
        const selectedEntries = this.entries.filter(entry => selectedItemIds.includes(entry.id));

        return selectedEntries.length > 0 ? this.formatter.formatEntries(selectedEntries) : "";
    }
}
