import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { RemovableBadge } from "@/components/ui/RemovableBadge";
import type { LorebookEntry } from "@/types/story";

interface EntryBadgeListProps {
    entries: LorebookEntry[];
    onRemove?: (entryId: string) => void;
    emptyMessage?: string;
    showCategory?: boolean;
    className?: string;
}

/**
 * Displays a list of lorebook entries as badges, optionally with remove buttons.
 */
export const EntryBadgeList = ({
    entries,
    onRemove,
    emptyMessage = "No entries",
    showCategory = false,
    className = ""
}: EntryBadgeListProps): JSX.Element => {
    if (entries.length === 0) return <div className="text-muted-foreground text-sm">{emptyMessage}</div>;

    const content = (entry: LorebookEntry) => (
        <>
            {entry.name}
            {showCategory && <span className="text-xs text-muted-foreground ml-1 capitalize">({entry.category})</span>}
        </>
    );

    return (
        <div className={`flex flex-wrap gap-2 max-h-[150px] overflow-y-auto ${className}`}>
            {entries.map(entry =>
                onRemove ? (
                    <RemovableBadge key={entry.id} onRemove={() => onRemove(entry.id)}>
                        {content(entry)}
                    </RemovableBadge>
                ) : (
                    <Badge key={entry.id} variant="secondary" className="flex items-center gap-1 px-3 py-1">
                        {content(entry)}
                    </Badge>
                )
            )}
        </div>
    );
};
