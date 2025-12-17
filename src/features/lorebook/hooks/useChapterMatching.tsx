import { createContext, type ReactNode, useContext, useState } from "react";
import type { LorebookEntry } from "@/types/story";

interface ChapterMatchingContextValue {
    chapterMatchedEntries: Map<string, LorebookEntry>;
    setChapterMatchedEntries: (entries: Map<string, LorebookEntry>) => void;
}

const ChapterMatchingContext = createContext<ChapterMatchingContextValue | null>(null);

interface ChapterMatchingProviderProps {
    children: ReactNode;
}

export const ChapterMatchingProvider = ({ children }: ChapterMatchingProviderProps) => {
    const [chapterMatchedEntries, setChapterMatchedEntries] = useState<Map<string, LorebookEntry>>(new Map());

    return (
        <ChapterMatchingContext.Provider value={{ chapterMatchedEntries, setChapterMatchedEntries }}>
            {children}
        </ChapterMatchingContext.Provider>
    );
};

export const useChapterMatching = (): ChapterMatchingContextValue => {
    const context = useContext(ChapterMatchingContext);
    if (!context) throw new Error("useChapterMatching must be used within ChapterMatchingProvider");

    return context;
};
