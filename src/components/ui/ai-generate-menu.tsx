import { useState } from "react";
import { AIModel, Prompt, AllowedModel } from "@/types/story";
import {
    Menubar,
    MenubarContent,
    MenubarItem,
    MenubarMenu,
    MenubarSeparator,
    MenubarSub,
    MenubarSubContent,
    MenubarSubTrigger,
    MenubarTrigger
} from "./menubar";
import { Loader2, ChevronDown, History } from "lucide-react";
import { PromptConfigDialog } from "./prompt-config-dialog";

interface LastUsedSelection {
    prompt: Prompt;
    model: AllowedModel;
}

interface AIGenerateMenuProps {
    isGenerating: boolean;
    isLoading: boolean;
    error: string | null;
    prompts: Prompt[];
    availableModels: AIModel[];
    promptType: string;
    buttonText: string;
    onGenerate: (prompt: Prompt, model: AllowedModel) => Promise<void>;
    lastUsed?: LastUsedSelection | null;
}

export function AIGenerateMenu({
    isGenerating,
    isLoading,
    error,
    prompts,
    promptType,
    buttonText,
    onGenerate,
    lastUsed
}: Omit<AIGenerateMenuProps, "availableModels">) {
    const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
    const filteredPrompts = prompts.filter(p => p.promptType === promptType);

    return (
        <Menubar>
            <MenubarMenu>
                <MenubarTrigger className="gap-2" disabled={isGenerating}>
                    {isGenerating ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Generating...
                        </>
                    ) : (
                        <>
                            {buttonText}
                            <ChevronDown className="h-4 w-4" />
                        </>
                    )}
                </MenubarTrigger>
                <MenubarContent>
                    {isLoading ? (
                        <MenubarItem disabled>Loading prompts...</MenubarItem>
                    ) : error ? (
                        <MenubarItem disabled>Error loading prompts</MenubarItem>
                    ) : filteredPrompts.length === 0 ? (
                        <MenubarItem disabled>No {promptType} prompts available</MenubarItem>
                    ) : (
                        <>
                            {lastUsed && (
                                <>
                                    <MenubarItem
                                        onClick={() => onGenerate(lastUsed.prompt, lastUsed.model)}
                                        disabled={isGenerating}
                                        className="bg-accent/50"
                                    >
                                        <History className="h-4 w-4 mr-2 text-muted-foreground" />
                                        <div className="flex flex-col">
                                            <span>{lastUsed.prompt.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {lastUsed.model.name}
                                            </span>
                                        </div>
                                    </MenubarItem>
                                    <MenubarSeparator />
                                </>
                            )}
                            {filteredPrompts.map(prompt => (
                                <MenubarSub key={prompt.id}>
                                    <MenubarSubTrigger>
                                        <div className="flex flex-col">
                                            <span>{prompt.name}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {prompt.messages.length} messages
                                            </span>
                                        </div>
                                    </MenubarSubTrigger>
                                    <MenubarSubContent className="max-h-[300px] overflow-y-auto">
                                        {prompt.allowedModels.map(model => (
                                            <MenubarItem
                                                key={model.id}
                                                onClick={() => onGenerate(prompt, model)}
                                                disabled={isGenerating}
                                            >
                                                <div className="flex flex-col">
                                                    <span>{model.name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {model.provider}
                                                    </span>
                                                </div>
                                            </MenubarItem>
                                        ))}
                                    </MenubarSubContent>
                                </MenubarSub>
                            ))}
                            <MenubarSeparator />
                            <MenubarItem onClick={() => setIsConfigDialogOpen(true)}>Configure Prompts...</MenubarItem>
                        </>
                    )}
                </MenubarContent>
            </MenubarMenu>

            <PromptConfigDialog
                open={isConfigDialogOpen}
                onOpenChange={setIsConfigDialogOpen}
                promptType={promptType as Prompt["promptType"]}
            />
        </Menubar>
    );
}
