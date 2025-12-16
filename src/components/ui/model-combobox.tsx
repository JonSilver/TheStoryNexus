import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AIModel } from "@/types/story";

interface ModelComboboxProps {
    models: AIModel[];
    value: string | undefined;
    onValueChange: (value: string | undefined) => void;
    placeholder?: string;
    emptyText?: string;
    className?: string;
    id?: string;
}

export const ModelCombobox = ({
    models,
    value,
    onValueChange,
    placeholder = "Select model",
    emptyText = "No models found",
    className,
    id
}: ModelComboboxProps) => {
    const [open, setOpen] = useState(false);
    const selectedModel = models.find(m => m.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal", className)}
                >
                    {selectedModel ? selectedModel.name : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Type to filter..." />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="none"
                                onSelect={() => {
                                    onValueChange(undefined);
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                                None
                            </CommandItem>
                            {models.map(model => (
                                <CommandItem
                                    key={model.id}
                                    value={model.name}
                                    onSelect={() => {
                                        onValueChange(model.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn("mr-2 h-4 w-4", value === model.id ? "opacity-100" : "opacity-0")}
                                    />
                                    {model.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
