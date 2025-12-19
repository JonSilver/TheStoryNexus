import { useCallback, useRef, useState } from "react";
import type { AllowedModel, LorebookEntry, Prompt } from "@/types/story";
import type { POVType } from "../components/POVSettingsPopover";

interface UseSceneBeatStateProps {
    initialCollapsed: boolean;
    initialUseMatchedChapter: boolean;
    initialUseMatchedSceneBeat: boolean;
    initialUseCustomContext: boolean;
    initialPovType: POVType | undefined;
    initialPovCharacter: string | undefined;
    lastUsedPrompt?: Prompt;
    lastUsedModel?: AllowedModel;
}

export const useSceneBeatState = ({
    initialCollapsed,
    initialUseMatchedChapter,
    initialUseMatchedSceneBeat,
    initialUseCustomContext,
    initialPovType,
    initialPovCharacter,
    lastUsedPrompt,
    lastUsedModel
}: UseSceneBeatStateProps) => {
    // Track if user has edited values (to know whether to use local or query data)
    const hasEditedCollapsedRef = useRef(false);
    const hasEditedTogglesRef = useRef(false);
    const hasEditedPovRef = useRef(false);

    // Local state for values that can be edited
    const [localCollapsed, setLocalCollapsed] = useState<boolean | null>(null);
    const [localMatchedChapter, setLocalMatchedChapter] = useState<boolean | null>(null);
    const [localMatchedSceneBeat, setLocalMatchedSceneBeat] = useState<boolean | null>(null);
    const [localCustomContext, setLocalCustomContext] = useState<boolean | null>(null);
    const [localPovType, setLocalPovType] = useState<POVType | undefined>(undefined);
    const [localPovCharacter, setLocalPovCharacter] = useState<string | undefined>(undefined);

    // UI state
    const [showMatchedEntries, setShowMatchedEntries] = useState(false);
    const [showPreviewDialog, setShowPreviewDialog] = useState(false);
    const [selectedPrompt, setSelectedPrompt] = useState<Prompt | undefined>(lastUsedPrompt);
    const [selectedModel, setSelectedModel] = useState<AllowedModel | undefined>(lastUsedModel);
    const [selectedItems, setSelectedItems] = useState<LorebookEntry[]>([]);

    // Derive actual values: use local if edited, otherwise initial/query data
    const collapsed = hasEditedCollapsedRef.current ? (localCollapsed ?? false) : initialCollapsed;
    const useMatchedChapter = hasEditedTogglesRef.current ? (localMatchedChapter ?? true) : initialUseMatchedChapter;
    const useMatchedSceneBeat = hasEditedTogglesRef.current
        ? (localMatchedSceneBeat ?? false)
        : initialUseMatchedSceneBeat;
    const useCustomContext = hasEditedTogglesRef.current ? (localCustomContext ?? false) : initialUseCustomContext;
    const povType = hasEditedPovRef.current ? localPovType : initialPovType;
    const povCharacter = hasEditedPovRef.current ? localPovCharacter : initialPovCharacter;

    // Collapsed handlers
    const setCollapsed = useCallback((value: boolean) => {
        hasEditedCollapsedRef.current = true;
        setLocalCollapsed(value);
    }, []);

    // Toggle handlers
    const setMatchedChapter = useCallback((value: boolean) => {
        hasEditedTogglesRef.current = true;
        setLocalMatchedChapter(value);
    }, []);

    const setMatchedSceneBeat = useCallback((value: boolean) => {
        hasEditedTogglesRef.current = true;
        setLocalMatchedSceneBeat(value);
    }, []);

    const setCustomContext = useCallback((value: boolean) => {
        hasEditedTogglesRef.current = true;
        setLocalCustomContext(value);
    }, []);

    // POV handlers
    const setPov = useCallback((newPovType: POVType | undefined, newPovCharacter: string | undefined) => {
        hasEditedPovRef.current = true;
        setLocalPovType(newPovType);
        setLocalPovCharacter(newPovCharacter);
    }, []);

    // Item selection handlers
    const addSelectedItem = useCallback((item: LorebookEntry) => {
        setSelectedItems(prev => (prev.some(i => i.id === item.id) ? prev : [...prev, item]));
    }, []);

    const removeSelectedItem = useCallback((itemId: string) => {
        setSelectedItems(prev => prev.filter(item => item.id !== itemId));
    }, []);

    return {
        // Derived state
        collapsed,
        useMatchedChapter,
        useMatchedSceneBeat,
        useCustomContext,
        povType,
        povCharacter,

        // UI state
        showMatchedEntries,
        setShowMatchedEntries,
        showPreviewDialog,
        setShowPreviewDialog,
        selectedPrompt,
        setSelectedPrompt,
        selectedModel,
        setSelectedModel,
        selectedItems,

        // Handlers
        setCollapsed,
        setMatchedChapter,
        setMatchedSceneBeat,
        setCustomContext,
        setPov,
        addSelectedItem,
        removeSelectedItem
    };
};
