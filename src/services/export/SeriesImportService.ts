import { seriesApi } from "../api/client";

export class SeriesImportService {
    async importSeries(file: File): Promise<string> {
        const result = await seriesApi.importSeries(file);
        return result.seriesId;
    }
}
