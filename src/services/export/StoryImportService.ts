import { storiesApi } from "../api/client";

export class StoryImportService {
    async importStory(file: File): Promise<string> {
        const result = await storiesApi.importStory(file);
        return result.id;
    }
}
