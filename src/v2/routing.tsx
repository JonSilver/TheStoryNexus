import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router";
import { useRouteParams } from "./routeParams";
import { getV2State } from "./state/useV2Store";

/**
 * URL routing for the shell (#81): the URL is the source of truth for where
 * the writer is. Screens keep the familiar goTo(tool) API; it now navigates
 * to a real URL, so browser back/forward and the Android back gesture move
 * between screens, refresh keeps the place, and any screen is linkable.
 */

export type V2Tool =
    | "write"
    | "brainstorm"
    | "story"
    | "settings"
    | "chapters"
    | "bible"
    | "library"
    | "actions"
    | "notes"
    | "read"
    | "providers"
    | "serieslist"
    | "guidepage";

const STORY_SCOPED: Partial<Record<V2Tool, string>> = {
    story: "",
    chapters: "/chapters",
    bible: "/bible",
    notes: "/notes",
    read: "/read",
    brainstorm: "/brainstorm"
};

const APP_SCOPED: Partial<Record<V2Tool, string>> = {
    library: "/library",
    settings: "/settings",
    actions: "/settings/actions",
    providers: "/settings/providers",
    serieslist: "/settings/series",
    guidepage: "/guide"
};

/** The URL for a screen, given the story (and its remembered chapter) it applies to. */
export const pathFor = (tool: V2Tool, storyId: string | null, chapterId?: string | null): string => {
    if (tool in APP_SCOPED) return APP_SCOPED[tool] as string;
    if (!storyId) return tool === "write" ? "/write" : tool === "brainstorm" ? "/brainstorm" : "/story";
    const base = `/story/${encodeURIComponent(storyId)}`;
    if (tool === "write") return chapterId ? `${base}/write/${encodeURIComponent(chapterId)}` : `${base}/write`;
    return `${base}${STORY_SCOPED[tool] ?? ""}`;
};

/** Which screen a URL shows — drives the bottom-nav highlight and the embedded-page frame. */
export const toolForPath = (pathname: string): V2Tool => {
    const appScoped = Object.entries(APP_SCOPED).find(([, path]) => pathname === path);
    if (appScoped) return appScoped[0] as V2Tool;
    if (pathname === "/write") return "write";
    if (pathname === "/brainstorm") return "brainstorm";
    const story = pathname.match(/^\/story\/[^/]+(?:\/([a-z]+))?/);
    if (!story) return pathname === "/story" ? "story" : "write";
    const section = story[1];
    if (!section) return "story";
    const tool = (Object.entries(STORY_SCOPED).find(([, path]) => path === `/${section}`)?.[0] ??
        (section === "write" ? "write" : "story")) as V2Tool;
    return tool;
};

/**
 * goTo pushes a history entry for the target screen. The story comes from the
 * URL when inside a story, else from the store — read at CALL time, so
 * "select a story, then goTo" lands on the story just chosen.
 * goBack is history-back when the writer arrived from inside the app, and the
 * fallback screen when they landed straight on this URL (back must never
 * leave the app).
 */
export const useNav = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const route = useRouteParams();

    const goTo = useCallback(
        (tool: V2Tool) => {
            const state = getV2State();
            const storyId = route.storyId ?? state.currentStoryId;
            const chapterId = storyId ? (state.lastChapterByStory[storyId] ?? null) : null;
            navigate(pathFor(tool, storyId, chapterId));
        },
        [navigate, route.storyId]
    );

    const goBack = useCallback(
        (fallback: V2Tool) => {
            if (location.key !== "default") navigate(-1);
            else {
                const state = getV2State();
                const storyId = route.storyId ?? state.currentStoryId;
                navigate(pathFor(fallback, storyId), { replace: true });
            }
        },
        [navigate, location.key, route.storyId]
    );

    return { goTo, goBack, navigate };
};
