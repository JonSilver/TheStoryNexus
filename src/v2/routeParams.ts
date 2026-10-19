import { createContext, useContext } from "react";

/** Route parameters for the current screen, provided by the story-scoped routes (#81). */
export interface RouteParams {
    storyId: string | null;
    chapterId: string | null;
    chatId: string | null;
}

export const RouteParamsContext = createContext<RouteParams>({ storyId: null, chapterId: null, chatId: null });

export const useRouteParams = () => useContext(RouteParamsContext);
