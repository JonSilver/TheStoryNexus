import { chaptersApi } from "@/services/api/client";

/**
 * Utility function to fetch chapter summaries imperatively (non-hook).
 * For use in resolver classes and other non-React contexts.
 *
 * @param storyId - The story ID
 * @param currentOrder - The chapter order to filter by
 * @param includeLatest - If true, includes the chapter at currentOrder
 * @returns Promise resolving to aggregated summary string
 */
export const fetchChapterSummaries = async (
    storyId: string,
    currentOrder: number,
    includeLatest = false
): Promise<string> => {
    const chapters = await chaptersApi.getByStory(storyId);

    const relevantChapters = includeLatest
        ? chapters.filter(ch => ch.order <= currentOrder)
        : chapters.filter(ch => ch.order < currentOrder);

    return relevantChapters
        .sort((a, b) => a.order - b.order)
        .map(ch => ch.summary || "")
        .filter(summary => summary.length > 0)
        .join("\n\n");
};

/**
 * Utility function to fetch all chapter summaries imperatively (non-hook).
 * For use in resolver classes and other non-React contexts.
 *
 * @param storyId - The story ID
 * @returns Promise resolving to all chapter summaries joined with '\n\n'
 */
export const fetchAllChapterSummaries = async (storyId: string): Promise<string> => {
    const chapters = await chaptersApi.getByStory(storyId);

    return chapters
        .sort((a, b) => a.order - b.order)
        .map(ch => ch.summary || "")
        .filter(summary => summary.length > 0)
        .join("\n\n");
};

/**
 * Utility function to fetch a single chapter summary imperatively (non-hook).
 * For use in resolver classes and other non-React contexts.
 *
 * @param chapterId - The chapter ID
 * @returns Promise resolving to the chapter summary string
 */
export const fetchChapterSummary = async (chapterId: string): Promise<string> => {
    const chapter = await chaptersApi.getById(chapterId);
    return chapter?.summary || "";
};
