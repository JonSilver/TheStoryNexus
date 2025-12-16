import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme-provider";
import { cn } from "@/lib/utils";
import { Monitor, Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
    isExpanded?: boolean;
}

const themeConfig = {
    light: { icon: Sun, next: "dark", label: "Light" },
    dark: { icon: Moon, next: "system", label: "Dark" },
    system: { icon: Monitor, next: "light", label: "System" }
} as const;

export function ThemeToggle({ isExpanded = false }: ThemeToggleProps) {
    const { theme, setTheme } = useTheme();
    const { icon: Icon, next, label } = themeConfig[theme];

    return (
        <Button
            variant="ghost"
            size={isExpanded ? "default" : "icon"}
            className={cn(
                "relative hover:bg-accent hover:text-accent-foreground",
                isExpanded ? "justify-start w-full px-3" : "h-9 w-9"
            )}
            onClick={() => setTheme(next)}
            title={`Theme: ${label}`}
        >
            <div className="flex items-center">
                <Icon className="h-5 w-5" />
                {isExpanded && <span className="ml-2">{label}</span>}
            </div>
            <span className="sr-only">Toggle theme (current: {label})</span>
        </Button>
    );
}
