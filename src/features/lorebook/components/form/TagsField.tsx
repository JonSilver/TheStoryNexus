import type { Control } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { CreateEntryForm } from "./entryFormUtils";

interface TagsFieldProps {
    control: Control<CreateEntryForm>;
    tagInput: string;
}

const TagsPreview = ({ tagInput }: { tagInput: string }) => {
    const tags = tagInput
        .split(",")
        .map(t => t.trim())
        .filter(Boolean);
    if (tags.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
                <Badge key={tag} variant="secondary" className="group">
                    {tag}
                </Badge>
            ))}
        </div>
    );
};

export const TagsField = ({ control, tagInput }: TagsFieldProps) => (
    <>
        <FormField
            control={control}
            name="tags"
            render={({ field }) => (
                <FormItem>
                    <FormLabel>Tags</FormLabel>
                    <FormControl>
                        <Input {...field} placeholder="Harry Potter, The Boy Who Lived, Quidditch Player" />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                        Enter tags separated by commas. The entry name is automatically used as a tag. You can use spaces
                        and special characters in tags.
                    </p>
                    <FormMessage />
                </FormItem>
            )}
        />
        <TagsPreview tagInput={tagInput} />
    </>
);
