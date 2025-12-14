import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_URLS } from "@/constants/urls";
import {
    useAISettingsQuery,
    useDeleteDemoDataMutation,
    useRefreshModelsMutation,
    useUpdateAPIKeyMutation,
    useUpdateDefaultModelMutation,
    useUpdateLocalApiUrlMutation
} from "@/features/ai/hooks/useAISettingsQuery";
import { cn } from "@/lib/utils";
import type { AIModel, AIProvider } from "@/types/story";
import { AlertTriangle, ArrowLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

type ProviderCardProps = {
    provider: AIProvider;
    title: string;
    keyLabel: string;
    keyPlaceholder: string;
    storedKey: string | undefined;
    models: AIModel[];
    defaultModel: string | undefined;
    isKeyMutating: boolean;
    isRefreshing: boolean;
    onSaveKey: (key: string) => void;
    onRefresh: () => void;
    onDefaultModelChange: (modelId: string | undefined) => void;
};

const ProviderCard = ({
    title,
    keyLabel,
    keyPlaceholder,
    storedKey,
    models,
    defaultModel,
    isKeyMutating,
    isRefreshing,
    onSaveKey,
    onRefresh,
    onDefaultModelChange
}: ProviderCardProps) => {
    const [inputKey, setInputKey] = useState(storedKey || "");
    const isPending = isKeyMutating || isRefreshing;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex justify-between items-center">
                    {title}
                    <Button variant="outline" size="sm" onClick={onRefresh} disabled={isPending || !storedKey?.trim()}>
                        {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh Models"}
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-2">
                    <Label>{keyLabel}</Label>
                    <div className="flex gap-2">
                        <Input
                            type="password"
                            placeholder={keyPlaceholder}
                            value={inputKey}
                            onChange={e => setInputKey(e.target.value)}
                        />
                        <Button onClick={() => onSaveKey(inputKey)} disabled={isPending || !inputKey.trim()}>
                            {isKeyMutating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                    </div>
                </div>

                {models.length > 0 && (
                    <div className="space-y-2">
                        <Label>Default Model</Label>
                        <Select
                            value={defaultModel || "none"}
                            onValueChange={value => onDefaultModelChange(value === "none" ? undefined : value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select default model" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">None</SelectItem>
                                {models.map(model => (
                                    <SelectItem key={model.id} value={model.id}>
                                        {model.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Select a default model for {title} generation</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default function SettingsPage() {
    const navigate = useNavigate();
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
    const [localApiUrlInput, setLocalApiUrlInput] = useState("");

    const { data: settings, isLoading: isLoadingSettings } = useAISettingsQuery();

    const updateKeyMutation = useUpdateAPIKeyMutation();
    const updateLocalUrlMutation = useUpdateLocalApiUrlMutation();
    const updateDefaultModelMutation = useUpdateDefaultModelMutation();
    const refreshModelsMutation = useRefreshModelsMutation();
    const deleteDemoMutation = useDeleteDemoDataMutation();

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const handleDeleteDemoData = () => {
        if (
            !confirm(
                "Are you sure you want to delete all demo data? This will remove the demo story, chapters, and lorebook entries. This action cannot be undone."
            )
        ) {
            return;
        }
        deleteDemoMutation.mutate();
    };

    if (isLoadingSettings) {
        return (
            <div className="p-8 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const allModels = settings?.availableModels || [];
    const openaiModels = allModels.filter(m => m.provider === "openai");
    const openrouterModels = allModels.filter(m => m.provider === "openrouter");
    const localModels = allModels.filter(m => m.provider === "local");

    const currentLocalUrl = localApiUrlInput || settings?.localApiUrl || "";

    return (
        <div className="p-8">
            <div className="max-w-2xl mx-auto">
                <div className="flex items-center mb-8">
                    <Button variant="ghost" className="gap-2" onClick={() => navigate(-1)}>
                        <ArrowLeft className="h-4 w-4" />
                        Back
                    </Button>
                    <h1 className="text-3xl font-bold ml-4">Settings</h1>
                </div>

                <div className="space-y-6">
                    <ProviderCard
                        provider="openai"
                        title="OpenAI Configuration"
                        keyLabel="OpenAI API Key"
                        keyPlaceholder="Enter your OpenAI API key"
                        storedKey={settings?.openaiKey}
                        models={openaiModels}
                        defaultModel={settings?.defaultOpenAIModel}
                        isKeyMutating={updateKeyMutation.isPending}
                        isRefreshing={refreshModelsMutation.isPending}
                        onSaveKey={key => updateKeyMutation.mutate({ provider: "openai", key })}
                        onRefresh={() => refreshModelsMutation.mutate("openai")}
                        onDefaultModelChange={modelId =>
                            updateDefaultModelMutation.mutate({ provider: "openai", modelId })
                        }
                    />

                    <ProviderCard
                        provider="openrouter"
                        title="OpenRouter Configuration"
                        keyLabel="OpenRouter API Key"
                        keyPlaceholder="Enter your OpenRouter API key"
                        storedKey={settings?.openrouterKey}
                        models={openrouterModels}
                        defaultModel={settings?.defaultOpenRouterModel}
                        isKeyMutating={updateKeyMutation.isPending}
                        isRefreshing={refreshModelsMutation.isPending}
                        onSaveKey={key => updateKeyMutation.mutate({ provider: "openrouter", key })}
                        onRefresh={() => refreshModelsMutation.mutate("openrouter")}
                        onDefaultModelChange={modelId =>
                            updateDefaultModelMutation.mutate({ provider: "openrouter", modelId })
                        }
                    />

                    {/* Local Models Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex justify-between items-center">
                                Local Models
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => refreshModelsMutation.mutate("local")}
                                    disabled={refreshModelsMutation.isPending}
                                >
                                    {refreshModelsMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "Refresh Models"
                                    )}
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Models from LM Studio</span>
                            </div>

                            <Collapsible
                                open={openSections.localAdvanced}
                                onOpenChange={() => toggleSection("localAdvanced")}
                            >
                                <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                                    <ChevronRight
                                        className={cn(
                                            "h-4 w-4 transition-transform",
                                            openSections.localAdvanced && "transform rotate-90"
                                        )}
                                    />
                                    Advanced Settings
                                </CollapsibleTrigger>
                                <CollapsibleContent className="mt-2 space-y-2">
                                    <div className="grid gap-2">
                                        <Label htmlFor="local-api-url">Local API URL</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                id="local-api-url"
                                                type="text"
                                                placeholder={API_URLS.LOCAL_AI_DEFAULT}
                                                value={currentLocalUrl}
                                                onChange={e => setLocalApiUrlInput(e.target.value)}
                                            />
                                            <Button
                                                onClick={() => updateLocalUrlMutation.mutate(currentLocalUrl)}
                                                disabled={updateLocalUrlMutation.isPending || !currentLocalUrl.trim()}
                                            >
                                                {updateLocalUrlMutation.isPending ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    "Save"
                                                )}
                                            </Button>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            The URL of your local LLM server. Default is {API_URLS.LOCAL_AI_DEFAULT}
                                        </p>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>

                            {localModels.length > 0 && (
                                <div className="space-y-2">
                                    <Label htmlFor="local-default">Default Model</Label>
                                    <Select
                                        value={settings?.defaultLocalModel || "none"}
                                        onValueChange={value =>
                                            updateDefaultModelMutation.mutate({
                                                provider: "local",
                                                modelId: value === "none" ? undefined : value
                                            })
                                        }
                                    >
                                        <SelectTrigger id="local-default">
                                            <SelectValue placeholder="Select default model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">None</SelectItem>
                                            {localModels.map(model => (
                                                <SelectItem key={model.id} value={model.id}>
                                                    {model.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        Select a default model for local generation
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Delete Demo Data Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Demo Data</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-2 p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md">
                                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500 flex-shrink-0 mt-0.5" />
                                <div className="text-sm text-red-800 dark:text-red-200">
                                    <p className="font-semibold mb-1">Warning</p>
                                    <p>
                                        This will permanently delete all demo content including stories, chapters, and
                                        lorebook entries marked as demo data.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Delete Demo Content</Label>
                                <Button
                                    onClick={handleDeleteDemoData}
                                    disabled={deleteDemoMutation.isPending}
                                    className="w-full"
                                    variant="destructive"
                                >
                                    {deleteDemoMutation.isPending ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Trash2 className="h-4 w-4 mr-2" />
                                    )}
                                    Delete All Demo Data
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Remove the demo spy thriller story and all related content
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
