import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
    message: string;
    actionLabel?: string;
    actionIcon?: LucideIcon;
    onAction?: () => void;
    className?: string;
}

export const EmptyState = ({
    message,
    actionLabel,
    actionIcon: ActionIcon = Plus,
    onAction,
    className = "h-[200px]"
}: EmptyStateProps) => (
    <div className={`flex flex-col items-center justify-center text-center p-6 ${className}`}>
        <p className="text-muted-foreground mb-4">{message}</p>
        {actionLabel && onAction && (
            <Button onClick={onAction}>
                <ActionIcon className="h-4 w-4 mr-2" />
                {actionLabel}
            </Button>
        )}
    </div>
);
