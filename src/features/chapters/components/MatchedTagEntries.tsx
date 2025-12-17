import { ChevronRight, Edit } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CreateEntryDialog } from "@/features/lorebook/components/CreateEntryDialog";
import { useChapterMatching } from "@/features/lorebook/hooks/useChapterMatching";
import { useStoryContext } from "@/features/stories/context/StoryContext";
import type { LorebookEntry } from "@/types/story";

export function MatchedTagEntries() {
    const { chapterMatchedEntries } = useChapterMatching();
    const { currentStoryId } = useStoryContext();
    const [editingEntry, setEditingEntry] = useState<LorebookEntry | null>(null);

    // Derive open states from matched entries, preserving user interactions
    const [userOpenStates, setUserOpenStates] = useState<Record<string, boolean>>({});
    const openStates = Array.from(chapterMatchedEntries.values()).reduce(
        (acc, entry) => {
            acc[entry.id] = userOpenStates[entry.id] ?? false;
            return acc;
        },
        {} as Record<string, boolean>
    );

    if (chapterMatchedEntries.size === 0) return null;
    if (!currentStoryId) return null;

    const handleOpenChange = (id: string, isOpen: boolean) => {
        setUserOpenStates(prev => ({ ...prev, [id]: isOpen }));
    };

    const handleEdit = (entry: LorebookEntry) => {
        // Ensure we pass the complete entry object
        setEditingEntry({
            ...entry,
            level: entry.level || "story",
            scopeId: entry.level === "story" ? currentStoryId : entry.scopeId,
            metadata: {
                importance: entry.metadata?.importance || "minor",
                status: entry.metadata?.status || "active",
                type: entry.metadata?.type || "",
                relationships: entry.metadata?.relationships || [],
                customFields: entry.metadata?.customFields || {}
            }
        });
    };

    return (
        <div className="p-4 space-y-2">
            <h3 className="text-sm font-semibold">Matched Tag Entries</h3>
            {Array.from(chapterMatchedEntries.values()).map(entry => (
                <Collapsible
                    key={entry.id}
                    open={openStates[entry.id]}
                    onOpenChange={isOpen => handleOpenChange(entry.id, isOpen)}
                >
                    <div className="flex items-center gap-2">
                        <CollapsibleTrigger className="flex flex-1 items-center gap-2 w-full text-left p-2 hover:bg-accent rounded-lg">
                            <ChevronRight className="h-4 w-4" />
                            <span>{entry.name}</span>
                        </CollapsibleTrigger>
                        {openStates[entry.id] && (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={e => {
                                    e.stopPropagation();
                                    handleEdit(entry);
                                }}
                                className="h-8 w-8"
                            >
                                <Edit className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                    <CollapsibleContent className="p-2 text-sm space-y-2 select-text">
                        <div className="select-text">
                            <span className="font-semibold">Tags: </span>
                            {entry.tags.join(", ")}
                        </div>
                        <div className="select-text">
                            <span className="font-semibold">Description: </span>
                            {entry.description}
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            ))}

            {editingEntry && (
                <CreateEntryDialog
                    open={!!editingEntry}
                    onOpenChange={open => !open && setEditingEntry(null)}
                    storyId={currentStoryId}
                    entry={editingEntry}
                />
            )}
        </div>
    );
}
