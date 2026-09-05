import { Link } from "react-router";
import { BookMarked, ExternalLink, Settings } from "lucide-react";

const LINKS = [
    { to: "/settings", label: "AI Settings", icon: Settings },
    { to: "/guide", label: "Guide", icon: BookMarked },
    { to: "/", label: "v1 workspace (everything not yet in v2)", icon: ExternalLink }
] as const;

export const MoreScreen = () => (
    <div className="flex h-full flex-col">
        <header className="border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
            <h1 className="text-lg font-semibold">More</h1>
        </header>
        <ul className="divide-y">
            {LINKS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                    <Link to={to} className="flex items-center gap-3 px-4 py-3">
                        <Icon className="h-5 w-5 text-muted-foreground" />
                        {label}
                    </Link>
                </li>
            ))}
        </ul>
        <p className="mt-auto p-4 text-center text-xs text-muted-foreground">
            The Story Nexus v2 preview — brainstorm, lorebook, notes and prompts still live in the v1 workspace during
            the rebuild.
        </p>
    </div>
);
