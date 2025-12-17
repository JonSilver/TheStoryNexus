import is from "@sindresorhus/is";
import type { LexicalEditor, NodeKey } from "lexical";
import { $getNodeByKey } from "lexical";
import { useCallback, useEffect, useRef, useState } from "react";
import { useCreateSceneBeatMutation, useSceneBeatQuery } from "@/features/scenebeats/hooks/useSceneBeatQuery";
import { randomUUID } from "@/utils/crypto";
import { logger } from "@/utils/logger";
import type { POVType } from "../components/POVSettingsPopover";

interface SceneBeatNodeType {
    getSceneBeatId(): string;
    setSceneBeatId(id: string): void;
    getType(): string;
}

interface UseSceneBeatDataProps {
    editor: LexicalEditor;
    nodeKey: NodeKey;
    currentStoryId: string | null;
    currentChapterId: string | null;
    defaultPovType?: POVType;
    defaultPovCharacter?: string;
}

interface UseSceneBeatDataResult {
    sceneBeatId: string;
    isLoaded: boolean;
    initialCommand: string;
    initialPovType: POVType | undefined;
    initialPovCharacter: string | undefined;
    useMatchedChapter: boolean;
    useMatchedSceneBeat: boolean;
    useCustomContext: boolean;
    collapsed: boolean;
}

export const useSceneBeatData = ({
    editor,
    nodeKey,
    currentStoryId,
    currentChapterId,
    defaultPovType = "Third Person Omniscient",
    defaultPovCharacter
}: UseSceneBeatDataProps): UseSceneBeatDataResult => {
    const [sceneBeatId, setSceneBeatId] = useState<string>("");
    const [needsCreate, setNeedsCreate] = useState(false);
    const createAttemptedRef = useRef(false);

    const createMutation = useCreateSceneBeatMutation();

    // Query only runs once we have a sceneBeatId
    const {
        data: sceneBeatData,
        isSuccess,
        isFetched,
        isError
    } = useSceneBeatQuery(sceneBeatId, {
        enabled: !!sceneBeatId && !needsCreate
    });

    // Extract sceneBeatId from Lexical node on mount
    const extractNodeId = useCallback(() => {
        let nodeSceneBeatId = "";
        editor.getEditorState().read(() => {
            const node = $getNodeByKey(nodeKey);
            const nodeType = node?.getType();
            if (node && nodeType === "scene-beat") 
                nodeSceneBeatId = (node as unknown as SceneBeatNodeType).getSceneBeatId();
            
        });
        return nodeSceneBeatId;
    }, [editor, nodeKey]);

    // Initial extraction and setup
    useEffect(() => {
        if (sceneBeatId) return;

        const nodeSceneBeatId = extractNodeId();

        if (nodeSceneBeatId) {
            logger.info("🔑 Found existing sceneBeatId:", nodeSceneBeatId);
            setSceneBeatId(nodeSceneBeatId);
        } else {
            logger.info("🆕 No sceneBeatId - will create new");
            const newId = randomUUID();

            // Set ID on Lexical node
            editor.update(
                () => {
                    const node = $getNodeByKey(nodeKey);
                    if (node?.getType() === "scene-beat") 
                        (node as unknown as SceneBeatNodeType).setSceneBeatId(newId);
                    
                },
                { discrete: true }
            );

            setSceneBeatId(newId);
            setNeedsCreate(true);
        }
    }, [editor, nodeKey, sceneBeatId, extractNodeId]);

    // Create DB record if needed
    useEffect(() => {
        if (!needsCreate || !sceneBeatId || !currentStoryId || !currentChapterId) return;
        if (createAttemptedRef.current) return;

        createAttemptedRef.current = true;
        createMutation.mutate(
            {
                id: sceneBeatId,
                storyId: currentStoryId,
                chapterId: currentChapterId,
                command: "",
                povType: defaultPovType,
                povCharacter: defaultPovCharacter
            },
            {
                onSuccess: () => {
                    setNeedsCreate(false);
                    logger.info("✅ Created new scene beat:", sceneBeatId);
                },
                onError: err => {
                    // Ignore UNIQUE constraint errors (React strict mode double-mount)
                    if (!err.message?.includes("UNIQUE constraint")) 
                        logger.error("❌ Failed to create scene beat:", err);
                    
                    setNeedsCreate(false);
                }
            }
        );
    }, [
        needsCreate,
        sceneBeatId,
        currentStoryId,
        currentChapterId,
        defaultPovType,
        defaultPovCharacter,
        createMutation
    ]);

    // Handle case where query fails (record doesn't exist) - create it
    useEffect(() => {
        if (!isError || needsCreate || !sceneBeatId || !currentStoryId || !currentChapterId) return;
        if (createAttemptedRef.current) return;

        createAttemptedRef.current = true;
        logger.info("🔄 DB record missing, creating:", sceneBeatId);
        createMutation.mutate(
            {
                id: sceneBeatId,
                storyId: currentStoryId,
                chapterId: currentChapterId,
                command: "",
                povType: defaultPovType,
                povCharacter: defaultPovCharacter
            },
            {
                onError: err => {
                    // Ignore UNIQUE constraint errors
                    if (!err.message?.includes("UNIQUE constraint")) 
                        logger.error("❌ Failed to create scene beat:", err);
                    
                }
            }
        );
    }, [
        isError,
        needsCreate,
        sceneBeatId,
        currentStoryId,
        currentChapterId,
        defaultPovType,
        defaultPovCharacter,
        createMutation
    ]);

    // Derive state from query data
    const isLoaded = (isSuccess && !!sceneBeatData) || (isFetched && needsCreate === false);

    const initialCommand = sceneBeatData?.command || "";
    const initialPovType = sceneBeatData?.povType || defaultPovType;
    const initialPovCharacter = sceneBeatData?.povCharacter || defaultPovCharacter;

    const metadata = sceneBeatData?.metadata;
    const useMatchedChapter = is.boolean(metadata?.useMatchedChapter) ? metadata.useMatchedChapter : true;
    const useMatchedSceneBeat = is.boolean(metadata?.useMatchedSceneBeat) ? metadata.useMatchedSceneBeat : false;
    const useCustomContext = is.boolean(metadata?.useCustomContext) ? metadata.useCustomContext : false;
    const collapsed = is.boolean(metadata?.collapsed) ? metadata.collapsed : false;

    return {
        sceneBeatId,
        isLoaded,
        initialCommand,
        initialPovType,
        initialPovCharacter,
        useMatchedChapter,
        useMatchedSceneBeat,
        useCustomContext,
        collapsed
    };
};
