import { MessageSquareQuote, Wand2 } from "lucide-react";
import { SELECTION_ACTIONS, type SelectionActionId } from "../../ai/selectionActions";

export interface ToolbarActions {
    onContinue: () => void;
    onSummarise: () => void;
    onSelectionAction: (actionId: SelectionActionId) => void;
    onAsk: () => void;
}

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
                {SELECTION_ACTIONS.map(({ actionId, label, icon: Icon }) => (
                    <button
                        key={actionId}
                        type="button"
                        className={className}
                        onClick={() => actions.onSelectionAction(actionId)}
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
