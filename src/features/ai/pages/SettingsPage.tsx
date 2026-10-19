import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "react-toastify";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { KEYED_PROVIDERS, KeyedProviderCard, LocalProviderCard } from "@/features/ai/components/ProviderCard";
import { useAISettingsQuery } from "@/features/ai/hooks/useAISettingsQuery";
import { useDeleteDemoDataMutation } from "@/features/demo/hooks/useDemoData";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function SettingsPage() {
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const { data: settings, isLoading, isError, refetch } = useAISettingsQuery();
    const deleteDemo = useDeleteDemoDataMutation();

    if (isLoading)
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    if (isError || !settings)
        return (
            <div className="flex flex-col items-center gap-3 p-8 text-center text-sm">
                <p className="text-muted-foreground">Couldn't load the AI settings — the server didn't answer.</p>
                <Button variant="outline" onClick={() => void refetch()}>
                    Try again
                </Button>
            </div>
        );

    const removeDemo = () =>
        deleteDemo.mutate(undefined, {
            onSuccess: ({ deleted }) =>
                toast.success(
                    `Demo data deleted: ${plural(deleted.stories, "story", "stories")}, ${plural(deleted.lorebookEntries, "bible entry", "bible entries")}`
                )
        });

    return (
        <div className="p-4 sm:p-8">
            <div className="mx-auto max-w-2xl space-y-6">
                {KEYED_PROVIDERS.map(provider => (
                    <KeyedProviderCard key={provider} provider={provider} settings={settings} />
                ))}
                <LocalProviderCard settings={settings} />

                <Card>
                    <CardHeader>
                        <CardTitle>Demo Data</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
                            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-500" />
                            <div className="text-sm text-red-800 dark:text-red-200">
                                <p className="mb-1 font-semibold">Warning</p>
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
                                disabled={deleteDemo.isPending}
                                className="w-full"
                                variant="destructive"
                            >
                                {deleteDemo.isPending ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Trash2 className="mr-2 h-4 w-4" />
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

            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Demo Data"
                description="This will permanently delete all demo content including stories, chapters, and lorebook entries. This action cannot be undone."
                onConfirm={removeDemo}
                confirmLabel="Delete All"
            />
        </div>
    );
}
