import type { LucideIcon } from "lucide-react";
import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ActionButtonSize = "default" | "sm";

const ICON_SIZES: Record<ActionButtonSize, string> = {
    default: "h-4 w-4",
    sm: "h-3 w-3"
};

const BUTTON_SIZES: Record<ActionButtonSize, string> = {
    default: "",
    sm: "h-6 w-6"
};

interface ActionButtonProps {
    icon: LucideIcon;
    tooltip: string;
    onClick: (e: MouseEvent) => void;
    variant?: "ghost" | "destructive";
    size?: ActionButtonSize;
    className?: string;
}

export const ActionButton = ({
    icon: Icon,
    tooltip,
    onClick,
    variant = "ghost",
    size = "default",
    className
}: ActionButtonProps) => (
    <TooltipProvider>
        <Tooltip>
            <TooltipTrigger asChild>
                <Button
                    variant={variant}
                    size="icon"
                    onClick={onClick}
                    className={cn(BUTTON_SIZES[size], variant === "destructive" && "hover:text-destructive", className)}
                >
                    <Icon className={ICON_SIZES[size]} />
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltip}</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
);
