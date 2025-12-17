import { attemptPromise } from "@jfdi/attempt";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import type { LorebookEntry } from "@/types/story";
import { randomUUID } from "@/utils/crypto";
import { useCreateLorebookMutation, useUpdateLorebookMutation } from "../hooks/useLorebookQuery";
import { LevelBadge } from "./LevelBadge";

interface CreateEntryDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    storyId?: string;
    seriesId?: string;
    entry?: LorebookEntry;
    defaultCategory?: LorebookCategory;
}

type LorebookLevel = LorebookEntry["level"];
type LorebookCategory = LorebookEntry["category"];

const CATEGORIES: LorebookCategory[] = [
    "character",
    "location",
    "item",
    "event",
    "note",
    "synopsis",
    "starting scenario",
    "timeline"
];
const IMPORTANCE_LEVELS = ["major", "minor", "background"] as const;
const STATUS_OPTIONS = ["active", "inactive", "historical"] as const;

type ImportanceLevel = (typeof IMPORTANCE_LEVELS)[number];
type StatusOption = (typeof STATUS_OPTIONS)[number];

interface CreateEntryForm {
    level: LorebookLevel;
    scopeId: string;
    name: string;
    category: LorebookCategory;
    importance: ImportanceLevel;
    tags: string;
    description: string;
    type: string;
    status: StatusOption;
    isDisabled: boolean;
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

    const defaultLevel: LorebookLevel = entry?.level || (seriesId ? "series" : "story");
    const defaultScopeId = entry?.scopeId || seriesId || storyId || "";

    const form = useForm<CreateEntryForm>({
        defaultValues: {
            level: defaultLevel,
            scopeId: defaultScopeId,
            name: entry?.name || "",
            category: entry?.category || defaultCategory || "character",
            importance: entry?.metadata?.importance || "minor",
            tags: entry?.tags?.join(", ") || "",
            description: entry?.description || "",
            type: entry?.metadata?.type || "",
            status: entry?.metadata?.status || "active",
            isDisabled: entry?.isDisabled || false
        }
    });

    const selectedLevel = form.watch("level");
    const tagInput = form.watch("tags");

    // Reset form when entry changes (dialog opened with different entry)
    useEffect(() => {
        if (open) {
            const newDefaultLevel: LorebookLevel = entry?.level || (seriesId ? "series" : "story");
            const newDefaultScopeId = entry?.scopeId || seriesId || storyId || "";

            form.reset({
                level: newDefaultLevel,
                scopeId: newDefaultScopeId,
                name: entry?.name || "",
                category: entry?.category || defaultCategory || "character",
                importance: entry?.metadata?.importance || "minor",
                tags: entry?.tags?.join(", ") || "",
                description: entry?.description || "",
                type: entry?.metadata?.type || "",
                status: entry?.metadata?.status || "active",
                isDisabled: entry?.isDisabled || false
            });
            setAdvancedOpen(false);
        }
    }, [open, entry, seriesId, storyId, defaultCategory, form]);

    const handleLevelChange = (value: LorebookLevel) => {
        form.setValue("level", value);
        if (value === "global") form.setValue("scopeId", "");
        else if (value === "story") form.setValue("scopeId", storyId || "");
        else if (value === "series") form.setValue("scopeId", story?.seriesId || "");
    };

    const handleSubmit = async (data: CreateEntryForm) => {
        const [error] = await attemptPromise(async () => {
            const processedTags = data.tags
                .split(",")
                .map(tag => tag.trim())
                .filter(Boolean);

            const dataToSubmit = {
                name: data.name,
                description: data.description,
                category: data.category,
                tags: processedTags,
                isDisabled: data.isDisabled,
                metadata: {
                    importance: data.importance,
                    status: data.status,
                    type: data.type,
                    relationships: [],
                    customFields: {}
                },
                level: data.level,
                scopeId: data.level === "global" ? undefined : data.scopeId
            };

            if (entry) {
                await updateMutation.mutateAsync({
                    id: entry.id,
                    data: dataToSubmit
                });
            } else {
                await createMutation.mutateAsync({
                    id: randomUUID(),
                    ...dataToSubmit,
                    storyId: storyId || data.scopeId || ""
                } as Omit<LorebookEntry, "createdAt">);
            }
            onOpenChange(false);
        });
        if (error) {
            // Error toast is already handled by the mutation
        }
    };

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
                        {/* Level Selection */}
                        <FormField
                            control={form.control}
                            name="level"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Level</FormLabel>
                                    <Select onValueChange={handleLevelChange} value={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="global">Global</SelectItem>
                                            <SelectItem value="series">Series</SelectItem>
                                            <SelectItem value="story">Story</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Series Selector */}
                        {selectedLevel === "series" && (
                            <FormField
                                control={form.control}
                                name="scopeId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Series</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select series" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {seriesList?.map(series => (
                                                    <SelectItem key={series.id} value={series.id}>
                                                        {series.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        {/* Story Selector (when not in story context) */}
                        {selectedLevel === "story" && !storyId && (
                            <div className="space-y-2">
                                <FormLabel>Story</FormLabel>
                                <Input value={story?.title || ""} disabled placeholder="Current story" />
                            </div>
                        )}

                        {/* Story display (when in story context) */}
                        {selectedLevel === "story" && storyId && (
                            <div className="space-y-2">
                                <FormLabel>Story</FormLabel>
                                <div className="text-sm text-muted-foreground">
                                    This entry will be created for the current story
                                </div>
                            </div>
                        )}

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
                            <FormField
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Category</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select category" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {CATEGORIES.map(category => (
                                                    <SelectItem key={category} value={category}>
                                                        {category.charAt(0).toUpperCase() + category.slice(1)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="importance"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Importance</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select importance" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {IMPORTANCE_LEVELS.map(level => (
                                                    <SelectItem key={level} value={level}>
                                                        {level.charAt(0).toUpperCase() + level.slice(1)}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="tags"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Tags</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            placeholder="Harry Potter, The Boy Who Lived, Quidditch Player"
                                        />
                                    </FormControl>
                                    <p className="text-sm text-muted-foreground">
                                        Enter tags separated by commas. The entry name is automatically used as a tag.
                                        You can use spaces and special characters in tags.
                                    </p>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Show current tags preview */}
                        {tagInput && (
                            <div className="flex flex-wrap gap-2">
                                {tagInput.split(",").map(
                                    tag =>
                                        tag.trim() && (
                                            <Badge key={tag.trim()} variant="secondary" className="group">
                                                {tag.trim()}
                                            </Badge>
                                        )
                                )}
                            </div>
                        )}

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

                        {/* Advanced Section */}
                        <Collapsible
                            open={advancedOpen}
                            onOpenChange={setAdvancedOpen}
                            className="border rounded-md p-2"
                        >
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="flex w-full justify-between p-2" type="button">
                                    <span className="font-semibold">Advanced Settings</span>
                                    {advancedOpen ? (
                                        <ChevronUp className="h-4 w-4" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4" />
                                    )}
                                </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-4 pt-2">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="type"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Type</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        placeholder="E.g., Protagonist, Villain, Capital City"
                                                    />
                                                </FormControl>
                                                <p className="text-xs text-muted-foreground">
                                                    Specific type within the category (e.g., Protagonist, Villain,
                                                    Capital City)
                                                </p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="status"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Status</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value}>
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select status" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        {STATUS_OPTIONS.map(status => (
                                                            <SelectItem key={status} value={status}>
                                                                {status.charAt(0).toUpperCase() + status.slice(1)}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <FormLabel>Custom Fields</FormLabel>
                                    <div className="border rounded-md p-3 bg-muted/20">
                                        <p className="text-sm text-muted-foreground mb-2">
                                            Custom fields will be added in a future update. These will allow you to add
                                            any additional information specific to your lorebook entries.
                                        </p>
                                    </div>
                                </div>

                                <FormField
                                    control={form.control}
                                    name="isDisabled"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl>
                                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                                            </FormControl>
                                            <FormLabel className="!mt-0">Disable this entry</FormLabel>
                                            <p className="text-xs text-muted-foreground ml-2">
                                                Disabled entries won't be matched in text or included in AI context
                                            </p>
                                        </FormItem>
                                    )}
                                />
                            </CollapsibleContent>
                        </Collapsible>

                        <div className="flex justify-end gap-3">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                {createMutation.isPending || updateMutation.isPending
                                    ? "Saving..."
                                    : entry
                                      ? "Update"
                                      : "Create"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
