import type { SeriesExport } from "@/types/story";
import { seriesApi } from "../api/client";

export class SeriesExportService {
    async exportSeries(seriesId: string): Promise<SeriesExport> {
        return await seriesApi.exportSeries(seriesId);
    }
}
