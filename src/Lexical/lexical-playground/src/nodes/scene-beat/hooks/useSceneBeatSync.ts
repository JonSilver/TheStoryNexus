import { useMemo, useRef, useEffect, useCallback } from "react";
import { debounce, type DebouncedFunc } from "lodash";
import { useUpdateSceneBeatMutation } from "@/features/scenebeats/hooks/useSceneBeatQuery";
import type { SceneBeat } from "@/types/story";
import { logger } from "@/utils/logger";

const DEBOUNCE_DELAY_MS = 500;

type SaveCommandFunc = DebouncedFunc<(command: string) => void> & {
    flush: () => void;
};

export const useSceneBeatSync = (sceneBeatId: string) => {
    const sceneBeatIdRef = useRef(sceneBeatId);
    const updateMutation = useUpdateSceneBeatMutation();

    useEffect(() => {
        sceneBeatIdRef.current = sceneBeatId;
    }, [sceneBeatId]);

    // Create debounced save function once, uses ref for ID
    const saveCommand = useMemo(() => {
        const debouncedFn = debounce((command: string) => {
            if (!sceneBeatIdRef.current) {
                logger.warn("⚠️ No sceneBeatId, skipping save");
                return;
            }

            logger.info("💾 Saving command to DB:", { id: sceneBeatIdRef.current, length: command.length });
            updateMutation.mutate(
                { id: sceneBeatIdRef.current, data: { command } },
                {
                    onSuccess: () => logger.info("✅ Command saved successfully"),
                    onError: err => logger.error("❌ Error saving SceneBeat command:", err)
                }
            );
        }, DEBOUNCE_DELAY_MS);

        return debouncedFn as SaveCommandFunc;
    }, [updateMutation]);

    const saveToggles = useMemo(
        () =>
            debounce((useMatchedChapter: boolean, useMatchedSceneBeat: boolean, useCustomContext: boolean) => {
                if (!sceneBeatId) return;

                const updatedSceneBeat: Partial<SceneBeat> = {
                    metadata: {
                        useMatchedChapter,
                        useMatchedSceneBeat,
                        useCustomContext
                    }
                };
                updateMutation.mutate(
                    { id: sceneBeatId, data: updatedSceneBeat },
                    {
                        onError: err => logger.error("Error updating scene beat toggle states:", err)
                    }
                );
            }, DEBOUNCE_DELAY_MS),
        [sceneBeatId, updateMutation]
    );

    const savePOVSettings = useCallback(
        (
            povType: "First Person" | "Third Person Limited" | "Third Person Omniscient" | undefined,
            povCharacter: string | undefined
        ) => {
            if (!sceneBeatId) return;

            updateMutation.mutate(
                { id: sceneBeatId, data: { povType, povCharacter } },
                {
                    onError: err => logger.error("Error saving POV settings:", err)
                }
            );
        },
        [sceneBeatId, updateMutation]
    );

    const saveGeneratedContent = useCallback(
        (generatedContent: string, accepted: boolean) => {
            if (!sceneBeatId) return;

            updateMutation.mutate(
                { id: sceneBeatId, data: { generatedContent, accepted } },
                {
                    onError: err => logger.error("Error saving generated content:", err)
                }
            );
        },
        [sceneBeatId, updateMutation]
    );

    const saveAccepted = useCallback(
        (accepted: boolean) => {
            if (!sceneBeatId) return;

            updateMutation.mutate(
                { id: sceneBeatId, data: { accepted } },
                {
                    onError: err => logger.error("Error updating accepted status:", err)
                }
            );
        },
        [sceneBeatId, updateMutation]
    );

    return {
        saveCommand,
        flushCommand: () => saveCommand.flush(),
        saveToggles,
        savePOVSettings,
        saveGeneratedContent,
        saveAccepted
    };
};
