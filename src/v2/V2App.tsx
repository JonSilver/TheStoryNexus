import { BookOpen, Lightbulb, PenLine, Settings } from "lucide-react";
import { lazy } from "react";
import { useState } from "react";
import { ActionsScreen } from "./screens/ActionsScreen";
import { AppSettingsScreen } from "./screens/AppSettingsScreen";
import { BibleScreen } from "./screens/BibleScreen";
import { BrainstormScreen } from "./screens/BrainstormScreen";
import { ChaptersScreen } from "./screens/ChaptersScreen";
import { EmbeddedPage } from "./screens/EmbeddedPage";
import { NotesScreen } from "./screens/NotesScreen";
import { ReadScreen } from "./screens/ReadScreen";
import { StoriesScreen } from "./screens/StoriesScreen";
import { StoryHubScreen } from "./screens/StoryHubScreen";
import { WriteScreen } from "./screens/WriteScreen";

const SettingsPage = lazy(() => import("@/features/ai/pages/SettingsPage"));
const SeriesListPage = lazy(() => import("@/features/series/pages/SeriesListPage"));
const GuidePage = lazy(() => import("@/features/guide/pages/GuidePage"));

/**
 * IA ordered by frequency of use while writing: Write (with the in-editor
 * reference panel for bible lookups and quick notes) · Brainstorm · Story
 * (this story's hub, named after it) · Settings. Chapters, bible, notes and
 * the library hang off the hub; the AI-actions drawer off Settings.
 */
const TOOLS = [
    { id: "write", label: "Write", icon: PenLine, Screen: WriteScreen },
    { id: "brainstorm", label: "Brainstorm", icon: Lightbulb, Screen: BrainstormScreen },
    { id: "story", label: "Story", icon: BookOpen, Screen: StoryHubScreen },
    { id: "settings", label: "Settings", icon: Settings, Screen: AppSettingsScreen }
] as const;

export type V2Tool =
    | (typeof TOOLS)[number]["id"]
    | "chapters"
    | "bible"
    | "library"
    | "actions"
    | "notes"
    | "read"
    | "providers"
    | "serieslist"
    | "guidepage";

const SUB_SCREENS = {
    chapters: { Screen: ChaptersScreen, parent: "story" },
    bible: { Screen: BibleScreen, parent: "story" },
    library: { Screen: StoriesScreen, parent: "story" },
    notes: { Screen: NotesScreen, parent: "story" },
    read: { Screen: ReadScreen, parent: "story" },
    actions: { Screen: ActionsScreen, parent: "settings" }
} as const;

// Former full-page routes hosted inside the shell — nothing the app links
// to may strand the writer on a navless page
const EMBEDS = {
    providers: { title: "AI providers & models", parent: "settings", Page: SettingsPage },
    serieslist: { title: "Series", parent: "settings", Page: SeriesListPage },
    guidepage: { title: "Guide", parent: "settings", Page: GuidePage }
} as const;

export default function V2App() {
    const [tool, setTool] = useState<V2Tool>("write");
    const sub = tool in SUB_SCREENS ? SUB_SCREENS[tool as keyof typeof SUB_SCREENS] : null;
    const embed = tool in EMBEDS ? EMBEDS[tool as keyof typeof EMBEDS] : null;
    const ActiveScreen = sub ? sub.Screen : (TOOLS.find(t => t.id === tool) ?? TOOLS[0]).Screen;
    const highlighted = embed ? embed.parent : sub ? sub.parent : tool;

    return (
        <div className="flex h-dvh flex-col bg-background text-foreground">
            <main className="min-h-0 flex-1">
                {embed ? (
                    <EmbeddedPage title={embed.title} onBack={() => setTool(embed.parent)}>
                        <embed.Page />
                    </EmbeddedPage>
                ) : (
                    <ActiveScreen goTo={setTool} />
                )}
            </main>
            <nav className="flex shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
                {TOOLS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTool(id)}
                        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                            highlighted === id ? "text-primary" : "text-muted-foreground"
                        }`}
                        aria-current={highlighted === id ? "page" : undefined}
                    >
                        <Icon className="h-5 w-5" />
                        {label}
                    </button>
                ))}
            </nav>
        </div>
    );
}

export interface ScreenProps {
    goTo: (tool: V2Tool) => void;
}
