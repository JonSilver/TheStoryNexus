import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Series } from "@/types/story";
import { useCreateSeriesMutation, useUpdateSeriesMutation } from "../hooks/useSeriesQuery";

interface SeriesFormProps {
    series?: Series;
    onSuccess?: () => void;
}

interface SeriesFormData {
    name: string;
    description?: string;
}

export const SeriesForm = ({ series, onSuccess }: SeriesFormProps) => {
    const createMutation = useCreateSeriesMutation();
    const updateMutation = useUpdateSeriesMutation();

    const {
        register,
        handleSubmit,
        formState: { errors }
    } = useForm<SeriesFormData>({
        defaultValues: {
            name: series?.name || "",
            description: series?.description || ""
        }
    });

    const onSubmit = async (data: SeriesFormData) => {
        if (series) await updateMutation.mutateAsync({ id: series.id, data });
        else await createMutation.mutateAsync(data);

        onSuccess?.();
    };

    return (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
                <Label htmlFor="name">Series Name</Label>
                <Input
                    id="name"
                    {...register("name", { required: "Name is required" })}
                    placeholder="Enter series name"
                />
                {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
            </div>

            <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                    id="description"
                    {...register("description")}
                    placeholder="Enter series description"
                    rows={4}
                />
            </div>

            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {series ? "Update" : "Create"} Series
            </Button>
        </form>
    );
};
