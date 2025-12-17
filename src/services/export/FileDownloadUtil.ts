import { parseJSON, storyExportSchema } from "@/schemas/entities";
import type { Story, StoryExport } from "@/types/story";

export const downloadStoryExport = (exportData: StoryExport, story: Story): void => {
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = `data:application/json;charset=utf-8,${encodeURIComponent(dataStr)}`;
    const exportName = `story-${story.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportName);
    linkElement.click();
};

export const parseImportFile = (jsonData: string): StoryExport => {
    const result = parseJSON(storyExportSchema, jsonData);
    if (!result.success) {
        throw new Error(`Invalid story export data: ${result.error.message}`);
    }
    return result.data;
};
