import {
    BookMarked,
    ChevronRight,
    DatabaseBackup,
    Library,
    Moon,
    Settings,
    SlidersHorizontal,
    Sun
} from "lucide-react";
import { useTheme } from "@/lib/theme-provider";
import type { ScreenProps } from "../V2App";
import { useV2Store } from "../state/useV2Store";

/** App-level configuration — nothing story-scoped lives here. */
export const AppSettingsScreen = ({ goTo }: ScreenProps) => {
    const { autoSummarise, setAutoSummarise } = useV2Store();
    const { theme, setTheme } = useTheme();
    const rowClass = "flex w-full items-center gap-3 px-4 py-3 text-left";

    return (
        <div className="flex h-full flex-col overflow-y-auto">
            <header className="border-b px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))]">
                <h1 className="text-xl font-semibold">Settings</h1>
            </header>

            <ul className="divide-y border-b">
                <li>
                    <button type="button" className={rowClass} onClick={() => goTo("providers")}>
                        <Settings className="h-5 w-5 text-muted-foreground" />
                        <span className="flex-1">AI providers &amp; models</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                </li>
                <li>
                    <button type="button" className={rowClass} onClick={() => goTo("actions")}>
                        <SlidersHorizontal className="h-5 w-5 text-muted-foreground" />
                        <span className="flex-1">AI actions (advanced overrides)</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                </li>
                <li>
                    <button type="button" className={rowClass} onClick={() => goTo("serieslist")}>
                        <Library className="h-5 w-5 text-muted-foreground" />
                        <span className="flex-1">Series</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                </li>
                <li>
                    <button type="button" className={rowClass} onClick={() => goTo("guidepage")}>
                        <BookMarked className="h-5 w-5 text-muted-foreground" />
                        <span className="flex-1">Guide</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                </li>
            </ul>

            <label className="flex items-center gap-3 border-b px-4 py-3 text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                    <Sun className="h-4 w-4" />
                    <Moon className="h-4 w-4" />
                </span>
                <span className="flex-1">Appearance</span>
                <select
                    className="rounded-md border bg-background px-2 py-1.5"
                    aria-label="Theme"
                    value={theme}
                    onChange={e => setTheme(e.target.value as typeof theme)}
                >
                    <option value="system">System</option>
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                </select>
            </label>
            <label className="flex items-center gap-3 border-b px-4 py-3 text-sm">
                <input type="checkbox" checked={autoSummarise} onChange={e => setAutoSummarise(e.target.checked)} />
                <span>
                    Refresh chapter summaries automatically
                    <span className="block text-xs text-muted-foreground">
                        After you've substantially changed a chapter and paused, summarises it once in the background —
                        at most 6 times an hour, never just for opening a chapter. Spends tokens on your configured
                        model.
                    </span>
                </span>
            </label>

            <section className="border-b px-4 py-3">
                <h2 className="mb-1 flex items-center gap-2 font-medium">
                    <DatabaseBackup className="h-4 w-4 text-muted-foreground" /> Backup
                </h2>
                <p className="mb-2 text-xs text-muted-foreground">
                    A consistent snapshot of the whole database, safe to take while writing. Images under data/assets
                    need copying separately.
                </p>
                <a href="/api/admin/backup" download className="inline-block rounded-md border px-3 py-1.5 text-sm">
                    Download backup
                </a>
            </section>

            <p className="mt-auto p-4 text-center text-xs text-muted-foreground">The Story Nexus</p>
        </div>
    );
};
