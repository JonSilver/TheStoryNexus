import { X } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

interface RemovableBadgeProps {
    children: ReactNode;
    onRemove: () => void;
    className?: string;
}

export const RemovableBadge = ({ children, onRemove, className = "" }: RemovableBadgeProps) => (
    <Badge variant="secondary" className={`flex items-center gap-1 px-3 py-1 ${className}`}>
        {children}
        <button type="button" onClick={onRemove} className="ml-1 hover:text-destructive">
            <X className="h-3 w-3" />
        </button>
    </Badge>
);
