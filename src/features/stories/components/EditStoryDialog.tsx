import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { useUpdateStoryMutation } from "@/features/stories/hooks/useStoriesQuery";
import { Story } from "@/types/story";
import { useEffect } from "react";
import { useForm } from "react-hook-form";

interface EditStoryForm {
    title: string;
    author: string;
    language: string;
    synopsis: string;
    seriesId: string;
}

interface EditStoryDialogProps {
    story: Story | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditStoryDialog({ story, open, onOpenChange }: EditStoryDialogProps) {
    const updateStoryMutation = useUpdateStoryMutation();
    const { data: seriesList = [] } = useSeriesQuery();

    const form = useForm<EditStoryForm>({
        defaultValues: {
            title: story?.title || "",
            author: story?.author || "",
            language: story?.language || "English",
            synopsis: story?.synopsis || "",
            seriesId: story?.seriesId || "none"
        }
    });

    // Reset form when story changes (dialog opened with different story)
    useEffect(() => {
        if (story && open) {
            form.reset({
                title: story.title || "",
                author: story.author || "",
                language: story.language || "English",
                synopsis: story.synopsis || "",
                seriesId: story.seriesId || "none"
            });
        }
    }, [story, open, form]);

    const handleSubmit = (data: EditStoryForm) => {
        if (!story) return;

        updateStoryMutation.mutate(
            {
                id: story.id,
                data: {
                    title: data.title,
                    author: data.author,
                    language: data.language,
                    synopsis: data.synopsis,
                    seriesId: data.seriesId === "none" ? undefined : data.seriesId
                }
            },
            {
                onSuccess: () => {
                    onOpenChange(false);
                }
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Edit Story</DialogTitle>
                            <DialogDescription>Make changes to your story details here.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <FormField
                                control={form.control}
                                name="title"
                                rules={{ required: "Title is required" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Title</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter story title" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="author"
                                rules={{ required: "Author is required" }}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Author</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter author name" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="language"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Language</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select language" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="English">English</SelectItem>
                                                <SelectItem value="Spanish">Spanish</SelectItem>
                                                <SelectItem value="French">French</SelectItem>
                                                <SelectItem value="German">German</SelectItem>
                                                <SelectItem value="Chinese">Chinese</SelectItem>
                                                <SelectItem value="Japanese">Japanese</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="seriesId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Series (optional)</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select series" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">None</SelectItem>
                                                {seriesList.map(series => (
                                                    <SelectItem key={series.id} value={series.id}>
                                                        {series.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <p className="text-sm text-muted-foreground">
                                            Assign this story to a series to share lorebook entries
                                        </p>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="synopsis"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Synopsis</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter a brief synopsis (optional)" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="submit">Save Changes</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
