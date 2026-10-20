import { Check, ChevronsUpDown, Star } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    isSameModel,
    PROVIDER_NAMES,
    useAISettingsQuery,
    useToggleFavouriteModel
} from "@/features/ai/hooks/useAISettingsQuery";
import { cn } from "@/lib/utils";
import type { AIModel, AIProvider, ModelChoice } from "@/types/story";

const choiceOf = (model: AIModel): ModelChoice => ({ provider: model.provider, modelId: model.id });

/**
 * The one way to pick a model: search by name, id or provider; the writer's
 * starred favourites first, then every model by provider. Starring happens
 * right here, where the need arises.
 */
export const ModelSelector = ({
    value,
    onChange,
    noneLabel,
    id,
    ariaLabel = "Model"
}: {
    value: ModelChoice | null;
    onChange: (next: ModelChoice | null) => void;
    /** Offers "no model of its own" (e.g. use the app default), under this label. */
    noneLabel?: string;
    id?: string;
    ariaLabel?: string;
}) => {
    const [open, setOpen] = useState(false);
    const listId = useId();
    const { data: settings } = useAISettingsQuery();
    const toggleFavourite = useToggleFavouriteModel();
    const models = settings?.availableModels ?? [];
    const favourites = settings?.favouriteModels ?? [];
    const isFavourite = (model: AIModel) => favourites.some(f => isSameModel(f, choiceOf(model)));
    const selected = value ? models.find(m => isSameModel(choiceOf(m), value)) : undefined;
    const providers = (Object.keys(PROVIDER_NAMES) as AIProvider[]).filter(p => models.some(m => m.provider === p));

    const choose = (next: ModelChoice | null) => {
        onChange(next);
        setOpen(false);
    };

    const item = (model: AIModel, group: string, showProvider: boolean) => {
        const starred = isFavourite(model);
        return (
            <CommandItem
                key={`${group}:${model.provider}:${model.id}`}
                value={`${group}:${model.provider}:${model.id}`}
                keywords={[model.name, model.id, PROVIDER_NAMES[model.provider]]}
                onSelect={() => choose(choiceOf(model))}
            >
                <Check
                    className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value && isSameModel(choiceOf(model), value) ? "opacity-100" : "opacity-0"
                    )}
                />
                <span className="min-w-0 flex-1 truncate">{model.name}</span>
                {showProvider && (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {PROVIDER_NAMES[model.provider]}
                    </span>
                )}
                <button
                    type="button"
                    aria-label={`${starred ? "Unfavourite" : "Favourite"} ${model.name}`}
                    aria-pressed={starred}
                    className="ml-2 shrink-0 rounded p-0.5 hover:bg-accent"
                    // Starring must not also choose the model
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => {
                        e.stopPropagation();
                        toggleFavourite.mutate(choiceOf(model));
                    }}
                >
                    <Star className={cn("h-4 w-4", starred ? "fill-current text-amber-500" : "opacity-40")} />
                </button>
            </CommandItem>
        );
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-label={ariaLabel}
                    className="w-full justify-between font-normal"
                >
                    <span className="truncate">
                        {selected
                            ? `${selected.name} · ${PROVIDER_NAMES[selected.provider]}`
                            : value
                              ? `${value.modelId} (not available)`
                              : (noneLabel ?? "Choose a model")}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] min-w-72 p-0">
                <Command id={listId}>
                    <CommandInput placeholder="Search models…" />
                    <CommandList>
                        <CommandEmpty>
                            {models.length
                                ? "No model matches."
                                : "No models yet — add a provider in AI providers & models."}
                        </CommandEmpty>
                        {noneLabel && (
                            <CommandGroup>
                                <CommandItem value="none" keywords={[noneLabel]} onSelect={() => choose(null)}>
                                    <Check className={cn("mr-2 h-4 w-4", value ? "opacity-0" : "opacity-100")} />
                                    {noneLabel}
                                </CommandItem>
                            </CommandGroup>
                        )}
                        {models.some(isFavourite) && (
                            <CommandGroup heading="Favourites">
                                {models.filter(isFavourite).map(model => item(model, "favourite", true))}
                            </CommandGroup>
                        )}
                        {providers.map(provider => (
                            <CommandGroup key={provider} heading={PROVIDER_NAMES[provider]}>
                                {models.filter(m => m.provider === provider).map(model => item(model, "all", false))}
                            </CommandGroup>
                        ))}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};
