import type { Control, UseFormSetValue } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Series, Story } from "@/types/story";
import type { CreateEntryForm, LorebookLevel } from "./entryFormUtils";

interface LevelScopeFieldsProps {
    control: Control<CreateEntryForm>;
    setValue: UseFormSetValue<CreateEntryForm>;
    selectedLevel: LorebookLevel;
    storyId?: string;
    story?: Story;
    seriesList?: Series[];
}

export const LevelScopeFields = ({
    control,
    setValue,
    selectedLevel,
    storyId,
    story,
    seriesList
}: LevelScopeFieldsProps) => {
    const handleLevelChange = (value: LorebookLevel) => {
        setValue("level", value);
        if (value === "global") setValue("scopeId", "");
        else if (value === "story") setValue("scopeId", storyId || "");
        else if (value === "series") setValue("scopeId", story?.seriesId || "");
    };

    return (
        <>
            <FormField
                control={control}
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

            {selectedLevel === "series" && (
                <FormField
                    control={control}
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

            {selectedLevel === "story" && !storyId && (
                <div className="space-y-2">
                    <FormLabel>Story</FormLabel>
                    <Input value={story?.title || ""} disabled placeholder="Current story" />
                </div>
            )}

            {selectedLevel === "story" && storyId && (
                <div className="space-y-2">
                    <FormLabel>Story</FormLabel>
                    <div className="text-sm text-muted-foreground">This entry will be created for the current story</div>
                </div>
            )}
        </>
    );
};
