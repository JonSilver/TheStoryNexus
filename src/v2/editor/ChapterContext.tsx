import { createContext, useContext } from "react";

/**
 * Chapter identity for editor internals (decorator components included —
 * Lexical portals decorators from the composer's React tree, so context
 * propagates).
 */
export interface ChapterIdentity {
    storyId: string;
    chapterId: string;
}

const ChapterContext = createContext<ChapterIdentity | null>(null);

export const ChapterContextProvider = ChapterContext.Provider;

export const useChapterIdentity = (): ChapterIdentity => {
    const value = useContext(ChapterContext);
    if (!value) throw new Error("useChapterIdentity requires ChapterContextProvider");
    return value;
};
