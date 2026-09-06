import { Maximize2, MessageSquareQuote, Minimize2, RefreshCw, Wand2 } from "lucide-react";

export interface ToolbarActions {
    onContinue: () => void;
    onSummarise: () => void;
    onSelectionAction: (actionId: "rework" | "expand" | "shorten", label: string) => void;
    onAsk: () => void;
}

const SELECTION_ACTIONS = [
    ["rework", "Rework", RefreshCw],
    ["expand", "Expand", Maximize2],
    ["shorten", "Shorten", Minimize2]
] as const;

export const AiActionButtons = ({
    actions,
    hasSelection,
    className
}: {
    actions: ToolbarActions;
    hasSelection: boolean;
    className: string;
}) => (
    <>
        {!hasSelection && (
            <button
                type="button"
                className={className}
                onClick={actions.onContinue}
                aria-label="Continue writing"
                title="Continue writing"
            >
                <Wand2 className="h-4 w-4" />
            </button>
        )}
        {hasSelection && (
            <>
                {SELECTION_ACTIONS.map(([actionId, label, Icon]) => (
                    <button
                        key={actionId}
                        type="button"
                        className={className}
                        onClick={() => actions.onSelectionAction(actionId, label)}
                        aria-label={`${label} selection`}
                        title={`${label} selection`}
                    >
                        <Icon className="h-4 w-4" />
                    </button>
                ))}
                <button
                    type="button"
                    className={className}
                    onClick={actions.onAsk}
                    aria-label="Ask about selection"
                    title="Ask: free-form instruction on the selection"
                >
                    <MessageSquareQuote className="h-4 w-4" />
                </button>
            </>
        )}
    </>
);
