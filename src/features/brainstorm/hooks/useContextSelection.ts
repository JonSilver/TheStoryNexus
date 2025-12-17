import { useCallback, useState } from "react";
import type { LorebookEntry } from "@/types/story";

interface UseContextSelectionReturn {
    includeFullContext: boolean;
    contextOpen: boolean;
    selectedSummaries: string[];
    selectedItems: LorebookEntry[];
    selectedChapterContent: string[];
    toggleFullContext: () => void;
    toggleContextOpen: () => void;
    toggleSummary: (id: string) => void;
    addItem: (item: LorebookEntry) => void;
    removeItem: (id: string) => void;
    addChapterContent: (id: string) => void;
    removeChapterContent: (id: string) => void;
    clearSelections: () => void;
}

export const useContextSelection = (): UseContextSelectionReturn => {
    const [includeFullContext, setIncludeFullContext] = useState(false);
    const [contextOpen, setContextOpen] = useState(false);
    const [selectedSummaries, setSelectedSummaries] = useState<string[]>([]);
    const [selectedItems, setSelectedItems] = useState<LorebookEntry[]>([]);
    const [selectedChapterContent, setSelectedChapterContent] = useState<string[]>([]);

    const toggleFullContext = useCallback(() => {
        setIncludeFullContext(prev => {
            const newValue = !prev;
            if (newValue) {
                setSelectedSummaries([]);
                setSelectedItems([]);
                setSelectedChapterContent([]);
            }
            return newValue;
        });
    }, []);

    const toggleContextOpen = useCallback(() => {
        setContextOpen(prev => !prev);
    }, []);

    const toggleSummary = useCallback((id: string) => {
        setSelectedSummaries(prev => (prev.includes(id) ? prev.filter(summaryId => summaryId !== id) : [...prev, id]));
    }, []);

    const addItem = useCallback((item: LorebookEntry) => {
        setSelectedItems(prev => (prev.some(i => i.id === item.id) ? prev : [...prev, item]));
    }, []);

    const removeItem = useCallback((id: string) => {
        setSelectedItems(prev => prev.filter(item => item.id !== id));
    }, []);

    const addChapterContent = useCallback((id: string) => {
        setSelectedChapterContent(prev => (prev.includes(id) ? prev : [...prev, id]));
    }, []);

    const removeChapterContent = useCallback((id: string) => {
        setSelectedChapterContent(prev => prev.filter(chapterId => chapterId !== id));
    }, []);

    const clearSelections = useCallback(() => {
        setSelectedSummaries([]);
        setSelectedItems([]);
        setSelectedChapterContent([]);
    }, []);

    return {
        includeFullContext,
        contextOpen,
        selectedSummaries,
        selectedItems,
        selectedChapterContent,
        toggleFullContext,
        toggleContextOpen,
        toggleSummary,
        addItem,
        removeItem,
        addChapterContent,
        removeChapterContent,
        clearSelections
    };
};
