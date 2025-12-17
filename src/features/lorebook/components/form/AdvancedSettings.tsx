import { ChevronDown, ChevronUp } from "lucide-react";
import type { Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { CreateEntryForm } from "./entryFormUtils";
import { STATUS_OPTIONS } from "./entryFormUtils";
import { SelectField } from "./SelectField";

interface AdvancedSettingsProps {
    control: Control<CreateEntryForm>;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const AdvancedSettings = ({ control, open, onOpenChange }: AdvancedSettingsProps) => (
    <Collapsible open={open} onOpenChange={onOpenChange} className="border rounded-md p-2">
        <CollapsibleTrigger asChild>
            <Button variant="ghost" className="flex w-full justify-between p-2" type="button">
                <span className="font-semibold">Advanced Settings</span>
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Type</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="E.g., Protagonist, Villain, Capital City" />
                            </FormControl>
                            <p className="text-xs text-muted-foreground">
                                Specific type within the category (e.g., Protagonist, Villain, Capital City)
                            </p>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <SelectField
                    control={control}
                    name="status"
                    label="Status"
                    options={STATUS_OPTIONS}
                    placeholder="Select status"
                />
            </div>

            <div className="space-y-2">
                <FormLabel>Custom Fields</FormLabel>
                <div className="border rounded-md p-3 bg-muted/20">
                    <p className="text-sm text-muted-foreground mb-2">
                        Custom fields will be added in a future update. These will allow you to add any additional
                        information specific to your lorebook entries.
                    </p>
                </div>
            </div>

            <FormField
                control={control}
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
);
