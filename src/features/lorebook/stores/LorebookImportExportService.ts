import { attemptPromise } from "@jfdi/attempt";
import { lorebookExportSchema, parseJSON } from "@/schemas/entities";
import { lorebookApi } from "@/services/api/client";
import type { LorebookEntry } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import { downloadJSON } from "@/utils/export/jsonExportUtils";
import { logger } from "@/utils/logger";

export const exportEntries = (entries: LorebookEntry[], storyId: string): void => {
    const entriesToExport = entries.filter(entry => entry.level === "story" && entry.scopeId === storyId);

    const exportData = {
        version: "1.0",
        type: "lorebook",
        entries: entriesToExport
    };

    const filename = `lorebook-${storyId}-${Date.now()}.json`;
    downloadJSON(exportData, filename);
};

export const importEntries = async (
    jsonData: string,
    targetStoryId: string,
    onEntriesAdded: (entries: LorebookEntry[]) => void
): Promise<void> => {
    const result = parseJSON(lorebookExportSchema, jsonData);
    if (!result.success) throw new Error(`Invalid lorebook data: ${result.error.message}`);

    const newEntries: LorebookEntry[] = [];

    for (const entry of result.data.entries) {
        const newEntryData = {
            ...entry,
            id: randomUUID(),
            level: "story" as const,
            scopeId: targetStoryId
        };

        const [addError, createdEntry] = await attemptPromise(() => lorebookApi.create(newEntryData));

        if (addError) {
            logger.error("Error adding lorebook entry:", addError);
            throw addError;
        }

        newEntries.push(createdEntry);
    }

    onEntriesAdded(newEntries);
};
