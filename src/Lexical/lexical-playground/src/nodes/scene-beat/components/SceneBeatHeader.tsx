import { ChevronRight, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LorebookEntry } from "@/types/story";
import { cn } from "@/lib/utils";
import type { POVType } from "./POVSettingsPopover";
import { POVSettingsPopover } from "./POVSettingsPopover";

interface SceneBeatHeaderProps {
    collapsed: boolean;
    streaming: boolean;
    povType: POVType | undefined;
    povCharacter: string | undefined;
    characterEntries: LorebookEntry[];
    onToggleCollapsed: () => void;
    onStopGeneration: () => void;
    onToggleMatchedEntries: () => void;
    onDelete: () => void;
    onPovSave: (povType: POVType | undefined, povCharacter: string | undefined) => Promise<void>;
}

export const SceneBeatHeader = ({
    collapsed,
    streaming,
    povType,
    povCharacter,
    characterEntries,
    onToggleCollapsed,
    onStopGeneration,
    onToggleMatchedEntries,
    onDelete,
    onPovSave
}: SceneBeatHeaderProps) => (
    <div className="flex items-center justify-between p-2 gap-1">
        <div className="flex items-center gap-2 min-w-0">
            <button
                type="button"
                onClick={onToggleCollapsed}
                className="flex items-center justify-center hover:bg-accent/50 rounded-md w-6 h-6 shrink-0"
                aria-label={collapsed ? "Expand scene beat" : "Collapse scene beat"}
            >
                <ChevronRight className={cn("h-4 w-4 transition-transform", !collapsed && "rotate-90")} />
            </button>
            <span className="font-medium text-sm sm:text-base">Scene Beat</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
            {streaming && (
                <Button
                    variant="default"
                    size="sm"
                    onClick={onStopGeneration}
                    className="h-7 sm:h-8 px-2 sm:px-3 text-xs sm:text-sm"
                >
                    Stop
                </Button>
            )}

            <POVSettingsPopover
                povType={povType}
                povCharacter={povCharacter}
                characterEntries={characterEntries}
                onSave={onPovSave}
            />

            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={onToggleMatchedEntries}
                title="Matched Tags"
            >
                <Eye className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-destructive"
                aria-label="Delete scene beat"
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    </div>
);
