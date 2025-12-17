import { Wand2 } from "lucide-react";
import { RemovableBadge } from "@/components/ui/RemovableBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { useModelSelection } from "../hooks/useModelSelection";

interface ModelSelectorProps {
    modelSelection: ReturnType<typeof useModelSelection>;
}

export const ModelSelector = ({ modelSelection }: ModelSelectorProps) => {
    const { selectedModels, filteredModelGroups, modelSearch, setModelSearch, handleModelSelect, removeModel, handleUseDefaultModels } = modelSelection;

    return (
        <div className="border-t border-input pt-6">
            <div className="flex justify-between items-center mb-4">
                <h3 className="font-medium">Available Models</h3>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleUseDefaultModels}
                    className="flex items-center gap-2"
                >
                    <Wand2 className="h-4 w-4" />
                    Use Default Models
                </Button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                {selectedModels.map(model => (
                    <RemovableBadge key={model.id} onRemove={() => removeModel(model.id)}>
                        {model.name}
                    </RemovableBadge>
                ))}
            </div>

            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full text-left">
                        {selectedModels.length ? `${selectedModels.length} selected` : "Select a model"}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-96">
                    <div className="flex flex-col">
                        <Input
                            placeholder="Search models..."
                            value={modelSearch}
                            onChange={e => setModelSearch(e.target.value)}
                            className="mb-2"
                        />

                        <div className="max-h-64 overflow-auto">
                            {Object.keys(filteredModelGroups).length === 0 && (
                                <div className="p-2 text-sm text-muted-foreground">No models found</div>
                            )}
                            {Object.entries(filteredModelGroups).map(([provider, models]) => (
                                <div key={provider} className="pb-2">
                                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted">
                                        {provider}
                                    </div>
                                    {models.map(model => {
                                        const isSelected = selectedModels.some(m => m.id === model.id);
                                        return (
                                            <div
                                                key={model.id}
                                                role="option"
                                                tabIndex={0}
                                                aria-selected={isSelected}
                                                className={`px-2 py-1 hover:bg-accent hover:text-accent-foreground cursor-pointer ${isSelected ? "opacity-50 pointer-events-none" : ""}`}
                                                onClick={() => handleModelSelect(model.id)}
                                                onKeyDown={e => {
                                                    if (e.key === "Enter" || e.key === " ") handleModelSelect(model.id);
                                                }}
                                            >
                                                {model.name}
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};
