import { PlusCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSeriesQuery } from "@/features/series/hooks/useSeriesQuery";
import { useCreateStoryMutation } from "@/features/stories/hooks/useStoriesQuery";
import { randomUUID } from "@/utils/crypto";

interface CreateStoryForm {
    title: string;
    author: string;
    language: string;
    synopsis: string;
    seriesId: string;
}

const defaultValues: CreateStoryForm = {
    title: "",
    author: "",
    language: "English",
    synopsis: "",
    seriesId: "none"
};

export function CreateStoryDialog() {
    const [open, setOpen] = useState(false);
    const createStoryMutation = useCreateStoryMutation();
    const { data: seriesList = [] } = useSeriesQuery();

    const form = useForm<CreateStoryForm>({ defaultValues });

    const handleSubmit = (data: CreateStoryForm) => {
        createStoryMutation.mutate(
            {
                id: randomUUID(),
                title: data.title,
                author: data.author,
                language: data.language,
                synopsis: data.synopsis,
                seriesId: data.seriesId === "none" ? undefined : data.seriesId
            },
            {
                onSuccess: () => {
                    setOpen(false);
                    form.reset(defaultValues);
                }
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="lg" className="w-64">
                    <PlusCircle className="mr-2 h-5 w-5" />
                    Create New Story
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(handleSubmit)}>
                        <DialogHeader>
                            <DialogTitle>Create New Story</DialogTitle>
                            <DialogDescription>
                                Fill in the details for your new story. You can edit these later.
                            </DialogDescription>
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
                            <Button type="submit">Create Story</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
