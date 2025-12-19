import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ModelCombobox } from "@/components/ui/model-combobox";
import type { AIModel, AIProvider } from "@/types/story";

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

export const ProviderCard = ({
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
                        <ModelCombobox
                            models={models}
                            value={defaultModel}
                            onValueChange={onDefaultModelChange}
                            placeholder="Select default model"
                        />
                        <p className="text-xs text-muted-foreground">Select a default model for {title} generation</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
