import type { StoryExport } from "@/types/story";
import { storiesApi } from "../api/client";

export class StoryExportService {
    async exportStory(storyId: string): Promise<StoryExport> {
        return await storiesApi.exportStory(storyId);
    }
}
