import { attemptPromise } from "@jfdi/attempt";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import type { LorebookEntry } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import { useCreateLorebookMutation, useUpdateLorebookMutation } from "../hooks/useLorebookQuery";
import {
    AdvancedSettings,
    CATEGORIES,
    IMPORTANCE_LEVELS,
    LevelScopeFields,
    SelectField,
    TagsField,
    buildSubmitData,
    getDefaultFormValues
} from "./form";
import type { CreateEntryForm, LorebookCategory } from "./form";
import { LevelBadge } from "./LevelBadge";

interface CreateEntryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    storyId?: string;
    seriesId?: string;
    entry?: LorebookEntry;
    defaultCategory?: LorebookCategory;
}

export function CreateEntryDialog({
    open,
    onOpenChange,
    storyId,
    seriesId,
    entry,
    defaultCategory
}: CreateEntryDialogProps) {
    const createMutation = useCreateLorebookMutation();
    const updateMutation = useUpdateLorebookMutation();
    const [advancedOpen, setAdvancedOpen] = useState(false);

    const { data: story } = useStoryQuery(storyId || "");
    const { data: seriesList } = useSeriesQuery();

    const form = useForm<CreateEntryForm>({
        defaultValues: getDefaultFormValues(entry, seriesId, storyId, defaultCategory)
    });

    const selectedLevel = form.watch("level");
    const tagInput = form.watch("tags");

    useEffect(() => {
        if (open) {
            form.reset(getDefaultFormValues(entry, seriesId, storyId, defaultCategory));
            setAdvancedOpen(false);
        }
    }, [open, entry, seriesId, storyId, defaultCategory, form]);

    const handleSubmit = async (data: CreateEntryForm) => {
        const [error] = await attemptPromise(async () => {
            const dataToSubmit = buildSubmitData(data);

            if (entry)
                await updateMutation.mutateAsync({ id: entry.id, data: dataToSubmit });
            else
                await createMutation.mutateAsync({
                    id: randomUUID(),
                    ...dataToSubmit,
                    storyId: storyId || data.scopeId || ""
                } as Omit<LorebookEntry, "createdAt">);

            onOpenChange(false);
        });
        if (error) {
            // Error toast handled by mutation
        }
    };

    const isPending = createMutation.isPending || updateMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[625px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle>
                        <div className="flex items-center gap-2">
                            {entry ? "Edit Entry" : "Create New Entry"}
                            {entry && <LevelBadge level={entry.level} />}
                        </div>
                    </DialogTitle>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                        <LevelScopeFields
                            control={form.control}
                            setValue={form.setValue}
                            selectedLevel={selectedLevel}
                            storyId={storyId}
                            story={story}
                            seriesList={seriesList}
                        />

                        <FormField
                            control={form.control}
                            name="name"
                            rules={{ required: "Name is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                            <SelectField
                                control={form.control}
                                name="category"
                                label="Category"
                                options={CATEGORIES}
                                placeholder="Select category"
                            />
                            <SelectField
                                control={form.control}
                                name="importance"
                                label="Importance"
                                options={IMPORTANCE_LEVELS}
                                placeholder="Select importance"
                            />
                        </div>

                        <TagsField control={form.control} tagInput={tagInput} />

                        <FormField
                            control={form.control}
                            name="description"
                            rules={{ required: "Description is required" }}
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Textarea {...field} rows={6} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <AdvancedSettings control={form.control} open={advancedOpen} onOpenChange={setAdvancedOpen} />

                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isPending}>
                                {isPending ? "Saving..." : entry ? "Update" : "Create"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
