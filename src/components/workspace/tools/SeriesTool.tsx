import { attemptPromise } from "@jfdi/attempt";
import { Edit, FolderUp, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ConfirmDeleteDialog } from "@/components/ui/ConfirmDeleteDialog";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const handleDeleteClick = (e: MouseEvent) => {
        e.stopPropagation();
        setDeleteDialogOpen(true);
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
        <>
            <Card className="w-full border-2 border-gray-300 dark:border-gray-700 shadow-sm">
                <CardHeader>
                    <CardTitle>{series.name}</CardTitle>
                    {series.description && <CardDescription>{series.description}</CardDescription>}
                </CardHeader>
                <CardFooter className="flex justify-end gap-2">
                    <ActionButton icon={Edit} tooltip="Edit series" onClick={handleEdit} />
                    <ActionButton icon={FolderUp} tooltip="Export series" onClick={handleExport} />
                    <ActionButton icon={Trash2} tooltip="Delete series" onClick={handleDeleteClick} />
                </CardFooter>
            </Card>
            <ConfirmDeleteDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                description={`Delete series "${series.name}" and all its stories? This action cannot be undone.`}
                onConfirm={() => deleteSeriesMutation.mutate(series.id)}
            />
        </>
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
