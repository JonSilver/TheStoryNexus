import { ArrowLeft, Check, ChevronsUpDown, Copy, FileText, Plus, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { Prompt } from "@/types/story";
import { downloadJSONDataURI, generateExportFilename } from "@/utils/jsonExportUtils";
import { toastCRUD } from "@/utils/toastUtils";
import { useClonePromptMutation, useDeletePromptMutation, usePromptsQuery } from "../hooks/usePromptsQuery";
import { PromptForm } from "./PromptForm";
import { PromptsList } from "./PromptList";

export function PromptsManager() {
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | undefined>(undefined);
    const [isCreating, setIsCreating] = useState(false);
    const [showMobileForm, setShowMobileForm] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    const { data: allPrompts = [] } = usePromptsQuery({ includeSystem: true });
    const deletePromptMutation = useDeletePromptMutation();
    const clonePromptMutation = useClonePromptMutation();

    const handleNewPrompt = () => {
        setSelectedPrompt(undefined);
        setIsCreating(true);
        setShowMobileForm(true);
    };

    const handlePromptSelect = (prompt: Prompt) => {
        setSelectedPrompt(prompt);
        setIsCreating(false);
        setShowMobileForm(true);
    };

    const handleSave = () => {
        setShowMobileForm(false);
    };

    const handlePromptDelete = (promptId: string) => {
        if (selectedPrompt?.id === promptId) {
            setSelectedPrompt(undefined);
            setIsCreating(false);
            setShowMobileForm(false);
        }
    };

    const handleMobileDelete = () => {
        if (!selectedPrompt || selectedPrompt.isSystem) return;
        deletePromptMutation.mutate(selectedPrompt.id, {
            onSuccess: () => {
                handlePromptDelete(selectedPrompt.id);
            }
        });
    };

    const handleMobileClone = () => {
        if (!selectedPrompt) return;
        clonePromptMutation.mutate(selectedPrompt.id, {
            onSuccess: newPrompt => {
                setSelectedPrompt(newPrompt);
            }
        });
    };

    const handleExportPrompts = () => {
        // Only export non-system prompts
        const prompts = allPrompts.filter(p => !p.isSystem);

        const exportData = {
            version: "1.0",
            type: "prompts",
            prompts
        };

        const filename = generateExportFilename("prompts-export");
        downloadJSONDataURI(exportData, filename);
        toastCRUD.exportSuccess("Prompts");
    };

    const handleMobileBack = () => {
        setShowMobileForm(false);
        setIsCreating(false);
    };

    return (
        <div className="flex flex-col md:flex-row h-full">
            {/* Mobile: dropdown prompt selector */}
            <div className={cn("md:hidden p-2 border-b flex gap-2", showMobileForm && "hidden")}>
                <Popover open={mobileOpen} onOpenChange={setMobileOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="flex-1 justify-between">
                            <span className="truncate">
                                {selectedPrompt ? selectedPrompt.name : "Select prompt..."}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[calc(100vw-2rem)] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search prompts..." />
                            <CommandList>
                                <CommandEmpty>No prompts found.</CommandEmpty>
                                <CommandGroup>
                                    {allPrompts.map(prompt => (
                                        <CommandItem
                                            key={prompt.id}
                                            value={prompt.name}
                                            onSelect={() => {
                                                handlePromptSelect(prompt);
                                                setMobileOpen(false);
                                            }}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    selectedPrompt?.id === prompt.id ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            <span className="truncate">{prompt.name}</span>
                                            {prompt.isSystem && (
                                                <span className="ml-2 text-xs text-muted-foreground">System</span>
                                            )}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>
                <Button size="icon" onClick={handleNewPrompt} title="New Prompt">
                    <Plus className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={handleExportPrompts} title="Export">
                    <Upload className="h-4 w-4" />
                </Button>
            </div>

            {/* Mobile: Back button + actions when editing */}
            {showMobileForm && (
                <div className="md:hidden p-2 border-b flex justify-between items-center">
                    <Button variant="ghost" size="sm" onClick={handleMobileBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    {selectedPrompt && !isCreating && (
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={handleMobileClone}
                                title="Clone prompt"
                                className="h-8 w-8"
                            >
                                <Copy className="h-4 w-4" />
                            </Button>
                            {!selectedPrompt.isSystem && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleMobileDelete}
                                    title="Delete prompt"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Desktop: Fixed Sidebar */}
            <div className="hidden md:flex w-[300px] h-full border-r border-input bg-muted flex-col shrink-0">
                <div className="p-4 border-b border-input">
                    <div className="flex gap-2">
                        <Button onClick={handleNewPrompt} className="flex-1 flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            New Prompt
                        </Button>
                        <Button variant="outline" size="icon" onClick={handleExportPrompts} title="Export prompts">
                            <Upload className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <PromptsList
                        onPromptSelect={handlePromptSelect}
                        selectedPromptId={selectedPrompt?.id}
                        onPromptDelete={handlePromptDelete}
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className={cn("flex-1 h-full overflow-y-auto", !showMobileForm && "hidden md:block")}>
                <div className="max-w-3xl mx-auto p-4 md:p-6">
                    {isCreating || selectedPrompt ? (
                        <PromptForm
                            key={selectedPrompt?.id || "new"}
                            prompt={selectedPrompt}
                            onSave={handleSave}
                            onCancel={() => {
                                setIsCreating(false);
                                setShowMobileForm(false);
                            }}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full flex-col gap-6 text-muted-foreground p-4">
                            <FileText className="h-12 w-12 md:h-16 md:w-16 text-muted-foreground/50" />
                            <div className="text-center max-w-md">
                                <h3 className="text-lg md:text-xl font-semibold mb-2">No Prompt Selected</h3>
                                <p className="mb-6 text-sm md:text-base">
                                    Select a prompt to edit or create a new one.
                                </p>
                                <Button onClick={handleNewPrompt} className="flex items-center gap-2">
                                    <Plus className="h-4 w-4" />
                                    Create New Prompt
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
