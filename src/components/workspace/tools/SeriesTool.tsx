import { attemptPromise } from "@jfdi/attempt";
import { Edit, FolderUp, Trash2 } from "lucide-react";
import { type MouseEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CreateSeriesDialog } from "@/features/series/components/CreateSeriesDialog";
import { EditSeriesDialog } from "@/features/series/components/EditSeriesDialog";
import { useDeleteSeriesMutation, useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { SeriesExportService } from "@/services/export/SeriesExportService";
import type { Series } from "@/types/story";
import { logger } from "@/utils/logger";

const seriesExportService = new SeriesExportService();

function SeriesCard({
    series,
    onEdit,
    onExport
}: {
    series: Series;
    onEdit: (series: Series) => void;
    onExport: (series: Series) => void;
}) {
    const deleteSeriesMutation = useDeleteSeriesMutation();

    const handleDelete = async (e: MouseEvent) => {
        e.stopPropagation();
        if (window.confirm(`Delete series "${series.name}" and all its stories?`)) {
            deleteSeriesMutation.mutate(series.id);
        }
    };

    const handleEdit = (e: MouseEvent) => {
        e.stopPropagation();
        onEdit(series);
    };

    const handleExport = (e: MouseEvent) => {
        e.stopPropagation();
        onExport(series);
    };

    return (
        <Card className="w-full border-2 border-gray-300 dark:border-gray-700 shadow-sm">
            <CardHeader>
                <CardTitle>{series.name}</CardTitle>
                {series.description && <CardDescription>{series.description}</CardDescription>}
            </CardHeader>
            <CardFooter className="flex justify-end gap-2">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleEdit}>
                                <Edit className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Edit series</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleExport}>
                                <FolderUp className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Export series</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={handleDelete}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            <p>Delete series</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </CardFooter>
        </Card>
    );
}

export const SeriesTool = () => {
    const { data: seriesList = [] } = useSeriesQuery();
    const [editingSeries, setEditingSeries] = useState<Series | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    const handleEditSeries = (series: Series) => {
        setEditingSeries(series);
        setEditDialogOpen(true);
    };

    const handleExportSeries = async (series: Series) => {
        const [error] = await attemptPromise(async () => {
            await seriesExportService.exportSeries(series.id);
        });

        if (error) logger.error("Export failed:", error);
    };

    return (
        <div className="p-8">
            <div className="max-w-7xl mx-auto space-y-12">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-8">Your Series</h1>
                    <div className="flex justify-center gap-4 mb-8">
                        <CreateSeriesDialog />
                    </div>
                </div>

                {seriesList.length === 0 ? (
                    <div className="text-center text-muted-foreground">
                        No series yet. Create your first series to organise related stories!
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 place-items-center">
                        {seriesList.map(series => (
                            <SeriesCard
                                key={series.id}
                                series={series}
                                onEdit={handleEditSeries}
                                onExport={handleExportSeries}
                            />
                        ))}
                    </div>
                )}

                <EditSeriesDialog
                    key={editingSeries?.id}
                    series={editingSeries}
                    open={editDialogOpen}
                    onOpenChange={setEditDialogOpen}
                />
            </div>
        </div>
    );
};
