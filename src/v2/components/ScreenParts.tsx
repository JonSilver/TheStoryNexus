import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/** A screen's top bar: back, title, and its own actions on the right. */
export const ScreenHeader = ({
    title,
    onBack,
    backLabel = "Back",
    children
}: {
    title: ReactNode;
    onBack?: () => void;
    backLabel?: string;
    /** Actions, right-aligned. */
    children?: ReactNode;
}) => (
    <header className="flex items-center gap-2 border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        {onBack && (
            <button type="button" onClick={onBack} aria-label={backLabel}>
                <ArrowLeft className="h-5 w-5" />
            </button>
        )}
        <h1 className="min-w-0 truncate text-lg font-semibold">{title}</h1>
        {children && <div className="ml-auto flex shrink-0 items-center gap-2">{children}</div>}
    </header>
);

/** Nothing to show yet, and the one thing to do about it. */
export const EmptyState = ({
    message,
    actionLabel,
    onAction
}: {
    message: string;
    actionLabel: string;
    onAction: () => void;
}) => (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-muted-foreground">{message}</p>
        <button type="button" className="rounded-md bg-primary px-4 py-2 text-primary-foreground" onClick={onAction}>
            {actionLabel}
        </button>
    </div>
);

/** A story screen opened with no story chosen. */
export const NoStoryChosen = ({ onChoose }: { onChoose: () => void }) => (
    <EmptyState message="Pick a story first." actionLabel="Choose a story" onAction={onChoose} />
);
