import { BookOpen, Lightbulb, PenLine, Settings } from "lucide-react";
import { lazy, type ReactNode, useEffect, useMemo } from "react";
import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router";
import { useStoryQuery } from "@/features/stories/hooks/useStoriesQuery";
import { RouteParamsContext } from "./routeParams";
import { pathFor, toolForPath, useNav, type V2Tool } from "./routing";
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
import { uiState } from "./state/useV2Store";

export type { V2Tool } from "./routing";

const SettingsPage = lazy(() => import("@/features/ai/pages/SettingsPage"));
const SeriesListPage = lazy(() => import("@/features/series/pages/SeriesListPage"));
const GuidePage = lazy(() => import("@/features/guide/pages/GuidePage"));

/**
 * IA ordered by frequency of use while writing: Write (with the in-editor
 * reference panel for bible lookups and quick notes) · Brainstorm · Story
 * (this story's hub, named after it) · Settings. Chapters, bible, notes and
 * the library hang off the hub; the AI-actions drawer off Settings.
 */
const TABS = [
    { id: "write", label: "Write", icon: PenLine },
    { id: "brainstorm", label: "Brainstorm", icon: Lightbulb },
    { id: "story", label: "Story", icon: BookOpen },
    { id: "settings", label: "Settings", icon: Settings }
] as const;

const SCREENS = {
    write: WriteScreen,
    brainstorm: BrainstormScreen,
    story: StoryHubScreen,
    settings: AppSettingsScreen,
    chapters: ChaptersScreen,
    bible: BibleScreen,
    library: StoriesScreen,
    notes: NotesScreen,
    read: ReadScreen,
    actions: ActionsScreen
} as const;

/** Which bottom tab each screen belongs under. */
const TAB_FOR: Record<V2Tool, (typeof TABS)[number]["id"]> = {
    write: "write",
    brainstorm: "brainstorm",
    story: "story",
    chapters: "story",
    bible: "story",
    library: "story",
    notes: "story",
    read: "story",
    settings: "settings",
    actions: "settings",
    providers: "settings",
    serieslist: "settings",
    guidepage: "settings"
};

const Screen = ({ tool }: { tool: keyof typeof SCREENS }) => {
    const Component = SCREENS[tool];
    return <Component />;
};

/** Full pages hosted inside the shell; the frame supplies the only back control. */
const Embedded = ({ title, children }: { title: string; children: (goTo: (tool: V2Tool) => void) => ReactNode }) => {
    const { goTo, goBack } = useNav();
    return (
        <EmbeddedPage title={title} onBack={() => goBack("settings")}>
            {children(goTo)}
        </EmbeddedPage>
    );
};

const StoryNotFound = () => {
    const { goTo } = useNav();
    return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <p className="text-muted-foreground">That story doesn't exist — it may have been deleted.</p>
            <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
                onClick={() => {
                    uiState.setCurrentStory(null);
                    goTo("library");
                }}
            >
                Open the library
            </button>
        </div>
    );
};

/**
 * Everything under /story/:storyId: provides the URL's story (and chapter /
 * chat) to every screen, remembers it for "/", and says plainly when the
 * story in the URL doesn't exist rather than rendering a broken screen.
 */
const StoryScope = () => {
    const params = useParams();
    const storyId = params.storyId ?? null;
    const { error } = useStoryQuery(storyId ?? "");
    const routeParams = useMemo(
        () => ({ storyId, chapterId: params.chapterId ?? null, chatId: params.chatId ?? null }),
        [storyId, params.chapterId, params.chatId]
    );

    // Remembered for "/" and for resuming each story's chapter — however the writer got here
    useEffect(() => {
        if (!storyId) return;
        if (uiState.get().currentStoryId !== storyId) uiState.setCurrentStory(storyId);
        if (params.chapterId) uiState.setLastChapter(storyId, params.chapterId);
    }, [storyId, params.chapterId]);

    if ((error as { status?: number } | null)?.status === 404) return <StoryNotFound />;
    return (
        <RouteParamsContext.Provider value={routeParams}>
            <Outlet />
        </RouteParamsContext.Provider>
    );
};

/** "/" resumes where the writer left off; the interim ?tool= links still work. */
const LEGACY_TOOL_PARAM = new Set<V2Tool>(["providers", "serieslist", "guidepage", "library", "settings", "actions"]);

const RootRoute = () => {
    const location = useLocation();
    const requested = new URLSearchParams(location.search).get("tool") as V2Tool | null;
    if (requested && LEGACY_TOOL_PARAM.has(requested)) return <Navigate replace to={pathFor(requested, null)} />;
    const { currentStoryId, lastChapterByStory } = uiState.get();
    const chapterId = currentStoryId ? (lastChapterByStory[currentStoryId] ?? null) : null;
    return <Navigate replace to={pathFor("write", currentStoryId, chapterId)} />;
};

/** A story screen with no story in the URL: the remembered story's, at its real address — else the empty state. */
const Storyless = ({ tool }: { tool: "write" | "brainstorm" | "story" }) => {
    const { currentStoryId, lastChapterByStory } = uiState.get();
    if (!currentStoryId) return <Screen tool={tool} />;
    const chapterId = tool === "write" ? (lastChapterByStory[currentStoryId] ?? null) : null;
    return <Navigate replace to={pathFor(tool, currentStoryId, chapterId)} />;
};

const LegacyReader = () => <Navigate replace to={`/story/${useParams().storyId}/read`} />;

export default function V2App() {
    const location = useLocation();
    const { goTo } = useNav();
    const active = TAB_FOR[toolForPath(location.pathname)];

    return (
        <div className="flex h-dvh flex-col bg-background text-foreground">
            <main className="min-h-0 flex-1">
                <Routes>
                    <Route path="/" element={<RootRoute />} />
                    <Route path="/write" element={<Storyless tool="write" />} />
                    <Route path="/brainstorm" element={<Storyless tool="brainstorm" />} />
                    <Route path="/story" element={<Storyless tool="story" />} />
                    <Route path="/story/:storyId" element={<StoryScope />}>
                        <Route index element={<Screen tool="story" />} />
                        <Route path="write/:chapterId?" element={<Screen tool="write" />} />
                        <Route path="chapters" element={<Screen tool="chapters" />} />
                        <Route path="bible" element={<Screen tool="bible" />} />
                        <Route path="notes" element={<Screen tool="notes" />} />
                        <Route path="read" element={<Screen tool="read" />} />
                        <Route path="brainstorm/:chatId?" element={<Screen tool="brainstorm" />} />
                    </Route>
                    <Route path="/library" element={<Screen tool="library" />} />
                    <Route path="/settings" element={<Screen tool="settings" />} />
                    <Route path="/settings/actions" element={<Screen tool="actions" />} />
                    <Route
                        path="/settings/providers"
                        element={<Embedded title="AI providers & models">{() => <SettingsPage />}</Embedded>}
                    />
                    <Route
                        path="/settings/series"
                        element={
                            <Embedded title="Series">
                                {go => <SeriesListPage onOpenSeries={() => go("library")} />}
                            </Embedded>
                        }
                    />
                    <Route path="/guide" element={<Embedded title="Guide">{() => <GuidePage />}</Embedded>} />
                    {/* Legacy URLs */}
                    <Route path="/v2" element={<Navigate replace to="/" />} />
                    <Route path="/stories" element={<Navigate replace to="/library" />} />
                    <Route path="/stories/:storyId/read" element={<LegacyReader />} />
                    <Route path="/series/*" element={<Navigate replace to="/settings/series" />} />
                    <Route path="*" element={<Navigate replace to="/" />} />
                </Routes>
            </main>
            <nav className="flex shrink-0 border-t bg-background pb-[env(safe-area-inset-bottom)]">
                {TABS.map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => goTo(id)}
                        className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
                            active === id ? "text-primary" : "text-muted-foreground"
                        }`}
                        aria-current={active === id ? "page" : undefined}
                    >
                        <Icon className="h-5 w-5" />
                        {label}
                    </button>
                ))}
            </nav>
        </div>
    );
}
