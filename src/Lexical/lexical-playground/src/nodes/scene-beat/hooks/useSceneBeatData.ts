import { useState, useEffect } from "react";
import type { LexicalEditor, NodeKey } from "lexical";
import { $getNodeByKey } from "lexical";
import is from "@sindresorhus/is";
import { sceneBeatService } from "@/features/scenebeats/services/sceneBeatService";
import type { POVType } from "../components/POVSettingsPopover";
import { attemptPromise } from "@jfdi/attempt";
import { logger } from "@/utils/logger";

// Type guard for SceneBeatNode (uses type check to work with HMR)
interface SceneBeatNodeType {
    getSceneBeatId(): string;
    setSceneBeatId(id: string): void;
    getType(): string;
}

const isSceneBeatNode = (node: unknown): node is SceneBeatNodeType =>
    is.plainObject(node) &&
    "getType" in node &&
    is.function((node as SceneBeatNodeType).getType) &&
    (node as SceneBeatNodeType).getType() === "scene-beat";

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
}

/**
 * Custom hook to handle scene beat data loading and initialization.
 * Consolidates all data loading into a single initialization point.
 * Replaces multiple scattered useEffect hooks with single async initialization.
 *
 * @param props - Configuration including editor, node key, and context IDs
 * @returns Scene beat data and loading state
 */
export const useSceneBeatData = ({
    editor,
    nodeKey,
    currentStoryId,
    currentChapterId,
    defaultPovType = "Third Person Omniscient",
    defaultPovCharacter
}: UseSceneBeatDataProps): UseSceneBeatDataResult => {
    const [sceneBeatId, setSceneBeatId] = useState<string>("");
    const [isLoaded, setIsLoaded] = useState(false);
    const [initialCommand, setInitialCommand] = useState("");
    const [initialPovType, setInitialPovType] = useState<POVType | undefined>(defaultPovType);
    const [initialPovCharacter, setInitialPovCharacter] = useState<string | undefined>(defaultPovCharacter);
    const [useMatchedChapter, setUseMatchedChapter] = useState(true);
    const [useMatchedSceneBeat, setUseMatchedSceneBeat] = useState(false);
    const [useCustomContext, setUseCustomContext] = useState(false);

    useEffect(() => {
        const loadSceneBeat = async () => {
            if (isLoaded) return;

            // Get sceneBeatId from the node
            let nodeSceneBeatId = "";
            editor.getEditorState().read(() => {
                const node = $getNodeByKey(nodeKey);
                const nodeType = node?.getType();
                logger.info("🔑 $getNodeByKey result:", { nodeKey, nodeType, node });

                // Direct type check (HMR-safe)
                if (node && nodeType === "scene-beat") {
                    nodeSceneBeatId = (node as SceneBeatNodeType).getSceneBeatId();
                    logger.info("✅ Node has ID:", nodeSceneBeatId);
                } else {
                    logger.warn("❌ Node not found or wrong type", { nodeType });
                }
            });

            // No ID = newly created node (via plugin).
            // Create DB record now with the ID from the node
            if (!nodeSceneBeatId) {
                logger.warn("Scene beat node has no ID - creating one");
                const newId = crypto.randomUUID();

                // Set ID on node
                editor.update(() => {
                    const node = $getNodeByKey(nodeKey);
                    if (node?.getType() === "scene-beat") {
                        (node as SceneBeatNodeType).setSceneBeatId(newId);
                    }
                }, { discrete: true });

                // Create in DB
                if (currentStoryId && currentChapterId) {
                    await attemptPromise(async () =>
                        sceneBeatService.createSceneBeat({
                            id: newId,
                            storyId: currentStoryId,
                            chapterId: currentChapterId,
                            command: "",
                            povType: defaultPovType,
                            povCharacter: defaultPovCharacter
                        })
                    );
                }

                setSceneBeatId(newId);
                setIsLoaded(true);
                return;
            }

            // ID exists - load from DB
            logger.info("🔍 Loading SceneBeat:", nodeSceneBeatId);
            const [loadError, data] = await attemptPromise(async () =>
                sceneBeatService.getSceneBeat(nodeSceneBeatId)
            );

            if (loadError || !data) {
                // DB record doesn't exist - create it
                if (currentStoryId && currentChapterId) {
                    logger.info("🆕 Creating DB record for:", nodeSceneBeatId);
                    const [createError] = await attemptPromise(async () =>
                        sceneBeatService.createSceneBeat({
                            id: nodeSceneBeatId,
                            storyId: currentStoryId,
                            chapterId: currentChapterId,
                            command: "",
                            povType: defaultPovType,
                            povCharacter: defaultPovCharacter
                        })
                    );
                    // Ignore duplicate key errors (React strict mode double-mount)
                    if (createError && !createError.message?.includes("UNIQUE constraint")) {
                        logger.error("❌ Failed to create DB record:", createError);
                    }
                }
                setSceneBeatId(nodeSceneBeatId);
                setIsLoaded(true);
                return;
            }

            // Data loaded successfully
            logger.info("✅ Loaded command:", data.command);
            setInitialCommand(data.command || "");
            setInitialPovType(data.povType || defaultPovType);
            setInitialPovCharacter(data.povCharacter || defaultPovCharacter);

            if (data.metadata) {
                if (is.boolean(data.metadata.useMatchedChapter)) setUseMatchedChapter(data.metadata.useMatchedChapter);
                if (is.boolean(data.metadata.useMatchedSceneBeat)) setUseMatchedSceneBeat(data.metadata.useMatchedSceneBeat);
                if (is.boolean(data.metadata.useCustomContext)) setUseCustomContext(data.metadata.useCustomContext);
            }

            setSceneBeatId(nodeSceneBeatId);
            setIsLoaded(true);
        };

        loadSceneBeat();
    }, [editor, nodeKey, currentStoryId, currentChapterId, defaultPovType, defaultPovCharacter, isLoaded]);

    return {
        sceneBeatId,
        isLoaded,
        initialCommand,
        initialPovType,
        initialPovCharacter,
        useMatchedChapter,
        useMatchedSceneBeat,
        useCustomContext
    };
};
