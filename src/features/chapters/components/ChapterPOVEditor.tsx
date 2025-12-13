import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateChapterMutation } from "@/features/chapters/hooks/useChaptersQuery";
import { useLorebookContext } from "@/features/lorebook/context/LorebookContext";
import type { Chapter } from "@/types/story";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

interface ChapterPOVEditorProps {
    chapter: Chapter;
    onClose?: () => void;
}

interface POVForm {
    povType: "First Person" | "Third Person Limited" | "Third Person Omniscient";
    povCharacter?: string;
}

export function ChapterPOVEditor({ chapter, onClose }: ChapterPOVEditorProps) {
    const updateChapterMutation = useUpdateChapterMutation();
    const { entries } = useLorebookContext();

    const characterEntries = useMemo(() => entries.filter(entry => entry.category === "character"), [entries]);

    const form = useForm<POVForm>({
        defaultValues: {
            povType: chapter?.povType || "Third Person Omniscient",
            povCharacter: chapter?.povCharacter
        }
    });

    const povType = form.watch("povType");

    const handlePovTypeChange = (value: string, onChange: (value: string) => void) => {
        onChange(value);
        // Clear POV character when switching to omniscient
        if (value === "Third Person Omniscient") {
            form.setValue("povCharacter", undefined);
        }
    };

    const handleSubmit = async (data: POVForm) => {
        // Only include povCharacter if not omniscient
        const povCharacter = data.povType !== "Third Person Omniscient" ? data.povCharacter : undefined;

        updateChapterMutation.mutate(
            {
                id: chapter.id,
                data: {
                    povType: data.povType,
                    povCharacter
                }
            },
            {
                onSuccess: () => {
                    if (onClose) onClose();
                }
            }
        );
    };

    return (
        <div className="p-4">
            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="povType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Point of View</FormLabel>
                                <Select
                                    onValueChange={value => handlePovTypeChange(value, field.onChange)}
                                    defaultValue={field.value}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select POV type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="First Person">First Person</SelectItem>
                                        <SelectItem value="Third Person Limited">Third Person Limited</SelectItem>
                                        <SelectItem value="Third Person Omniscient">Third Person Omniscient</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {povType !== "Third Person Omniscient" && (
                        <FormField
                            control={form.control}
                            name="povCharacter"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>POV Character</FormLabel>
                                    {characterEntries.length > 0 ? (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select character" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {characterEntries.map(character => (
                                                    <SelectItem key={character.id} value={character.name}>
                                                        {character.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    ) : (
                                        <FormControl>
                                            <Input
                                                placeholder="Enter character name"
                                                {...field}
                                                value={field.value || ""}
                                            />
                                        </FormControl>
                                    )}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}

                    <div className="flex justify-end space-x-2">
                        <Button type="button" variant="outline" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit">Save Changes</Button>
                    </div>
                </form>
            </Form>
        </div>
    );
}
