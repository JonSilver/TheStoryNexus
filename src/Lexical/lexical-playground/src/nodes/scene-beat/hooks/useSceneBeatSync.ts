import { useMemo, useRef, useEffect } from "react";
import { debounce, type DebouncedFunc } from "lodash";
import { sceneBeatService } from "@/features/scenebeats/services/sceneBeatService";
import type { SceneBeat } from "@/types/story";
import { attemptPromise } from "@jfdi/attempt";
import { logger } from "@/utils/logger";

const DEBOUNCE_DELAY_MS = 500;

type SaveCommandFunc = DebouncedFunc<(command: string) => Promise<void>> & {
    flush: () => void;
};

/**
 * Custom hook to provide debounced database sync functions for scene beat.
 * Replaces useEffect antipattern by providing explicit save functions
 * to be called from event handlers.
 *
 * @param sceneBeatId - ID of the scene beat to sync
 * @returns Debounced save functions for various scene beat properties
 */
export const useSceneBeatSync = (sceneBeatId: string) => {
    const sceneBeatIdRef = useRef(sceneBeatId);

    useEffect(() => {
        sceneBeatIdRef.current = sceneBeatId;
    }, [sceneBeatId]);

    // Create debounced save function once, uses ref for ID
    const saveCommand = useMemo(() => {
        const debouncedFn = debounce(async (command: string) => {
            if (!sceneBeatIdRef.current) {
                logger.warn("⚠️ No sceneBeatId, skipping save");
                return;
            }

            logger.info("💾 Saving command to DB:", { id: sceneBeatIdRef.current, length: command.length });
            const [error] = await attemptPromise(async () =>
                sceneBeatService.updateSceneBeat(sceneBeatIdRef.current, { command })
            );
            if (error) {
                logger.error("❌ Error saving SceneBeat command:", error);
            } else {
                logger.info("✅ Command saved successfully");
            }
        }, DEBOUNCE_DELAY_MS);

        return debouncedFn as SaveCommandFunc;
    }, []);

    const saveToggles = useMemo(
        () =>
            debounce(async (useMatchedChapter: boolean, useMatchedSceneBeat: boolean, useCustomContext: boolean) => {
                if (!sceneBeatId) return;

                const updatedSceneBeat: Partial<SceneBeat> = {
                    metadata: {
                        useMatchedChapter,
                        useMatchedSceneBeat,
                        useCustomContext
                    }
                };
                const [error] = await attemptPromise(async () =>
                    sceneBeatService.updateSceneBeat(sceneBeatId, updatedSceneBeat)
                );
                if (error) {
                    logger.error("Error updating scene beat toggle states:", error);
                }
            }, DEBOUNCE_DELAY_MS),
        [sceneBeatId]
    );

    const savePOVSettings = async (
        povType: "First Person" | "Third Person Limited" | "Third Person Omniscient" | undefined,
        povCharacter: string | undefined
    ) => {
        if (!sceneBeatId) return;

        const [error] = await attemptPromise(async () =>
            sceneBeatService.updateSceneBeat(sceneBeatId, {
                povType,
                povCharacter
            })
        );
        if (error) {
            logger.error("Error saving POV settings:", error);
        }
    };

    const saveGeneratedContent = async (generatedContent: string, accepted: boolean) => {
        if (!sceneBeatId) return;

        const [error] = await attemptPromise(async () =>
            sceneBeatService.updateSceneBeat(sceneBeatId, {
                generatedContent,
                accepted
            })
        );
        if (error) {
            logger.error("Error saving generated content:", error);
        }
    };

    const saveAccepted = async (accepted: boolean) => {
        if (!sceneBeatId) return;

        const [error] = await attemptPromise(async () => sceneBeatService.updateSceneBeat(sceneBeatId, { accepted }));
        if (error) {
            logger.error("Error updating accepted status:", error);
        }
    };

    return {
        saveCommand,
        flushCommand: () => saveCommand.flush(),
        saveToggles,
        savePOVSettings,
        saveGeneratedContent,
        saveAccepted
    };
};
