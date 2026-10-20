import { Plus, Upload } from "lucide-react";
import { type ChangeEvent, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useConfirm } from "../../../v2/components/Dialogs";
import { SeriesCard } from "../components/SeriesCard";
import { SeriesForm } from "../components/SeriesForm";
import { useDeleteSeriesMutation, useImportSeriesMutation, useSeriesQuery } from "../hooks/useSeriesQuery";

const SeriesListPage = ({ onOpenSeries }: { onOpenSeries?: () => void }) => {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

    const { data: seriesList, isLoading } = useSeriesQuery();
    const deleteMutation = useDeleteSeriesMutation();
    const importSeries = useImportSeriesMutation();
    const confirm = useConfirm();

    const handleDelete = async (id: string) => {
        if (
            await confirm({
                message: "Delete this series? Its stories stay, just no longer in a series.",
                confirmLabel: "Delete"
            })
        )
            deleteMutation.mutate(id);
    };

    const handleImport = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file)
            importSeries.mutate(file, {
                onSuccess: ({ imported, assetsFailed }) => {
                    toast.success(
                        `Series restored — ${imported.stories} stor${imported.stories === 1 ? "y" : "ies"}, ${imported.lorebookEntries} series bible entr${imported.lorebookEntries === 1 ? "y" : "ies"}`
                    );
                    if (assetsFailed.length > 0)
                        toast.error(`${assetsFailed.length} image(s) couldn't be restored: ${assetsFailed.join(", ")}`);
                }
            });
    };

    if (isLoading) return <div>Loading series...</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6">
            <div className="mb-6 flex justify-end">
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
                        onClick={() => onOpenSeries?.()}
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
