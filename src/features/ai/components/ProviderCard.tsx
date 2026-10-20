import { Loader2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    PROVIDER_NAMES,
    useRefreshModelsMutation,
    useUpdateAPIKeyMutation,
    useUpdateLocalApiUrlMutation
} from "@/features/ai/hooks/useAISettingsQuery";
import type { AIProvider, AISettings } from "@/types/story";

const reportRefreshed = (provider: AIProvider, { healedDefault }: AISettings & { healedDefault?: string | null }) =>
    healedDefault
        ? toast.info(`The default model was no longer available — switched to ${healedDefault}`)
        : toast.success(`${PROVIDER_NAMES[provider]} models loaded`);

/** One provider's card: how it connects (children), and its models. */
const ProviderSection = ({
    provider,
    title,
    settings,
    canRefresh,
    children
}: {
    provider: AIProvider;
    title: string;
    settings: AISettings;
    canRefresh: boolean;
    children: ReactNode;
}) => {
    const refresh = useRefreshModelsMutation();
    const models = settings.availableModels.filter(m => m.provider === provider);
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    {title}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                            refresh.mutate(provider, { onSuccess: settings => reportRefreshed(provider, settings) })
                        }
                        disabled={refresh.isPending || !canRefresh}
                    >
                        {refresh.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh Models"}
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {children}
                <p className="text-xs text-muted-foreground">
                    {models.length
                        ? `${models.length} model${models.length === 1 ? "" : "s"} available — choose the default and favourites in any model selector.`
                        : "No models loaded yet."}
                </p>
            </CardContent>
        </Card>
    );
};

const KEYED: Record<Exclude<AIProvider, "local">, keyof AISettings> = {
    openai: "hasOpenaiKey",
    openrouter: "hasOpenrouterKey",
    gemini: "hasGeminiKey"
};

export const KEYED_PROVIDERS = Object.keys(KEYED) as Array<keyof typeof KEYED>;

/** A hosted provider: connects with an API key, which the server keeps. */
export const KeyedProviderCard = ({ provider, settings }: { provider: keyof typeof KEYED; settings: AISettings }) => {
    const [key, setKey] = useState("");
    const saveKey = useUpdateAPIKeyMutation();
    const hasKey = Boolean(settings[KEYED[provider]]);
    const name = PROVIDER_NAMES[provider];
    const save = () =>
        saveKey.mutate(
            { provider, key },
            {
                onSuccess: saved => {
                    setKey("");
                    reportRefreshed(provider, saved);
                }
            }
        );
    return (
        <ProviderSection provider={provider} title={name} settings={settings} canRefresh={hasKey}>
            <div className="grid gap-2">
                <Label htmlFor={`${provider}-key`}>{name} API key</Label>
                <div className="flex gap-2">
                    <Input
                        id={`${provider}-key`}
                        type="password"
                        placeholder={hasKey ? "Key saved — enter a new key to replace" : `Enter your ${name} API key`}
                        value={key}
                        onChange={e => setKey(e.target.value)}
                    />
                    <Button onClick={save} disabled={saveKey.isPending || !key.trim()}>
                        {saveKey.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                    </Button>
                </div>
            </div>
        </ProviderSection>
    );
};

/** A model server the app's server can reach: Ollama, LM Studio, anything OpenAI-compatible. */
export const LocalProviderCard = ({ settings }: { settings: AISettings }) => {
    // null: untouched, showing the saved URL — an emptied field stays empty
    const [draft, setDraft] = useState<string | null>(null);
    const saveUrl = useUpdateLocalApiUrlMutation();
    const url = draft ?? settings.localApiUrl ?? "";
    const save = () =>
        saveUrl.mutate(url.trim(), {
            onSuccess: saved => {
                setDraft(null);
                reportRefreshed("local", saved);
            }
        });
    return (
        <ProviderSection
            provider="local"
            title="Local Models"
            settings={settings}
            canRefresh={Boolean(settings.localApiUrl)}
        >
            <div className="grid gap-2">
                <Label htmlFor="local-api-url">Server URL (OpenAI-compatible)</Label>
                <div className="flex gap-2">
                    <Input
                        id="local-api-url"
                        type="text"
                        placeholder="e.g. http://localhost:11434/v1 (Ollama) or http://localhost:1234/v1 (LM Studio)"
                        value={url}
                        onChange={e => setDraft(e.target.value)}
                    />
                    <Button onClick={save} disabled={saveUrl.isPending || !url.trim()}>
                        {saveUrl.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save & test"}
                    </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                    Ollama: <code>http://&lt;host&gt;:11434/v1</code> · LM Studio:{" "}
                    <code>http://&lt;host&gt;:1234/v1</code>. The URL must be reachable from the machine running The
                    Story Nexus <em>server</em> — not from this browser. Saving tests the connection and loads the model
                    list.
                </p>
            </div>
        </ProviderSection>
    );
};
