import { Badge } from "@/components/ui/badge";
import type { LorebookLevel } from "@/types/story";

interface LevelBadgeProps {
    level: LorebookLevel;
}

const LEVEL_STYLES = {
    global: "bg-blue-500 hover:bg-blue-600 text-white",
    series: "bg-purple-500 hover:bg-purple-600 text-white",
    story: "bg-green-500 hover:bg-green-600 text-white"
} as const;

const LEVEL_LABELS = {
    global: "Global",
    series: "Series",
    story: "Story"
} as const;

export const LevelBadge = ({ level }: LevelBadgeProps) => (
    <Badge variant="secondary" className={LEVEL_STYLES[level]}>
        {LEVEL_LABELS[level]}
    </Badge>
);
