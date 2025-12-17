import { attemptPromise } from "@jfdi/attempt";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SeriesImportService } from "@/services/export/SeriesImportService";
import { SeriesCard } from "../components/SeriesCard";
import { SeriesForm } from "../components/SeriesForm";
import { useDeleteSeriesMutation, useSeriesQuery } from "../hooks/useSeriesQuery";

const seriesImportService = new SeriesImportService();

const SeriesListPage = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const { data: seriesList, isLoading } = useSeriesQuery();
    const deleteMutation = useDeleteSeriesMutation();

    const handleDelete = async (id: string) => {
        if (confirm("Delete this series? Stories will be orphaned but not deleted."))
            await deleteMutation.mutateAsync(id);
    };

    const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];
        const [error, newSeriesId] = await attemptPromise(async () => await seriesImportService.importSeries(file));

        if (error) {
            console.error("Failed to import series:", error);
            toast.error("Failed to import series");
            return;
        }

        toast.success("Series imported successfully");
        queryClient.invalidateQueries({ queryKey: ["series"] });

        // Navigate to the new series
        if (newSeriesId) navigate(`/series/${newSeriesId}`);

        // Reset the input
        event.target.value = "";
    };

    if (isLoading) return <div>Loading series...</div>;

    return (
        <div className="container mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Series</h1>
                <div className="flex gap-2">
                    <label htmlFor="import-series" aria-label="Import series">
                        <Button variant="outline" asChild>
                            <div>
                                <Upload className="w-4 h-4 mr-2" />
                                Import Series
                            </div>
                        </Button>
                    </label>
                    <input id="import-series" type="file" accept=".json" className="hidden" onChange={handleImport} />
                    <Button onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        New Series
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {seriesList?.map(series => (
                    <SeriesCard
                        key={series.id}
                        series={series}
                        onDelete={() => handleDelete(series.id)}
                        onClick={() => navigate(`/series/${series.id}`)}
                    />
                ))}
            </div>

            {seriesList?.length === 0 && (
                <div className="text-center text-muted-foreground mt-12">
                    No series yet. Create your first series to organize stories.
                </div>
            )}

            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Series</DialogTitle>
                    </DialogHeader>
                    <SeriesForm onSuccess={() => setIsCreateDialogOpen(false)} />
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SeriesListPage;
