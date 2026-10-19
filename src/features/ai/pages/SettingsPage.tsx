import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelCombobox } from "@/components/ui/model-combobox";
import { ProviderCard } from "@/features/ai/components/ProviderCard";
import {
    useAISettingsQuery,
    useDeleteDemoDataMutation,
    useRefreshModelsMutation,
    useUpdateAPIKeyMutation,
    useUpdateDefaultModelMutation,
    useUpdateLocalApiUrlMutation
} from "@/features/ai/hooks/useAISettingsQuery";

export default function SettingsPage() {
    const [localApiUrlInput, setLocalApiUrlInput] = useState("");
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const { data: settings, isLoading: isLoadingSettings } = useAISettingsQuery();

    const updateKeyMutation = useUpdateAPIKeyMutation();
    const updateLocalUrlMutation = useUpdateLocalApiUrlMutation();
    const updateDefaultModelMutation = useUpdateDefaultModelMutation();
    const refreshModelsMutation = useRefreshModelsMutation();
    const deleteDemoMutation = useDeleteDemoDataMutation();

    if (isLoadingSettings)
        return (
            <div className="p-8 flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );

    const allModels = settings?.availableModels || [];
    const openaiModels = allModels.filter(m => m.provider === "openai");
    const openrouterModels = allModels.filter(m => m.provider === "openrouter");
    const geminiModels = allModels.filter(m => m.provider === "gemini");
    const localModels = allModels.filter(m => m.provider === "local");

    const currentLocalUrl = localApiUrlInput || settings?.localApiUrl || "";

    return (
        <div className="p-4 sm:p-8">
            <div className="max-w-2xl mx-auto">
                <div className="space-y-6">
                    <ProviderCard
                        provider="openai"
                        title="OpenAI Configuration"
                        keyLabel="OpenAI API Key"
                        keyPlaceholder="Enter your OpenAI API key"
                        hasStoredKey={Boolean(settings?.hasOpenaiKey)}
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
                        hasStoredKey={Boolean(settings?.hasOpenrouterKey)}
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

                    <ProviderCard
                        provider="gemini"
                        title="Google Gemini Configuration"
                        keyLabel="Gemini API Key"
                        keyPlaceholder="Enter your Gemini API key"
                        hasStoredKey={Boolean(settings?.hasGeminiKey)}
                        models={geminiModels}
                        defaultModel={settings?.defaultGeminiModel}
                        isKeyMutating={updateKeyMutation.isPending}
                        isRefreshing={refreshModelsMutation.isPending}
                        onSaveKey={key => updateKeyMutation.mutate({ provider: "gemini", key })}
                        onRefresh={() => refreshModelsMutation.mutate("gemini")}
                        onDefaultModelChange={modelId =>
                            updateDefaultModelMutation.mutate({ provider: "gemini", modelId })
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
                            <div className="grid gap-2">
                                <Label htmlFor="local-api-url">Server URL (OpenAI-compatible)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="local-api-url"
                                        type="text"
                                        placeholder="e.g. http://localhost:11434/v1 (Ollama) or http://localhost:1234/v1 (LM Studio)"
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
                                            "Save & test"
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Ollama: <code>http://&lt;host&gt;:11434/v1</code> · LM Studio:{" "}
                                    <code>http://&lt;host&gt;:1234/v1</code>. The URL must be reachable from the machine
                                    running The Story Nexus <em>server</em> — not from this browser. Saving tests the
                                    connection and loads the model list.
                                </p>
                            </div>

                            {localModels.length > 0 && (
                                <div className="space-y-2">
                                    <Label htmlFor="local-default">Default Model</Label>
                                    <ModelCombobox
                                        id="local-default"
                                        models={localModels}
                                        value={settings?.defaultLocalModel}
                                        onValueChange={modelId =>
                                            updateDefaultModelMutation.mutate({
                                                provider: "local",
                                                modelId
                                            })
                                        }
                                        placeholder="Select default model"
                                    />
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
                                    onClick={() => setShowDeleteDialog(true)}
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

            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Demo Data"
                description="This will permanently delete all demo content including stories, chapters, and lorebook entries. This action cannot be undone."
                onConfirm={() => deleteDemoMutation.mutate()}
                confirmLabel="Delete All"
            />
        </div>
    );
}
