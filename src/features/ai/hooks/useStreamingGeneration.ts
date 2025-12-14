import { aiService } from "@/services/ai/AIService";
import { logger } from "@/utils/logger";
import { attemptPromise } from "@jfdi/attempt";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";

type StreamingState = {
    isStreaming: boolean;
    streamedText: string;
    isComplete: boolean;
};

type UseStreamingGenerationReturn = StreamingState & {
    processStream: (response: Response) => Promise<string>;
    abort: () => void;
    reset: () => void;
};

/**
 * Reusable hook for streaming AI generation.
 * Handles stream processing, state management, and abort logic.
 */
export const useStreamingGeneration = (): UseStreamingGenerationReturn => {
    const [state, setState] = useState<StreamingState>({
        isStreaming: false,
        streamedText: "",
        isComplete: false
    });

    const processStream = useCallback(async (response: Response): Promise<string> => {
        if (response.status === 204) {
            logger.info("Generation was aborted");
            return "";
        }

        if (!response.ok) {
            throw new Error("Failed to generate response");
        }

        setState({ isStreaming: true, streamedText: "", isComplete: false });

        const chunks: string[] = [];

        const [error] = await attemptPromise(
            () =>
                new Promise<void>((resolve, reject) => {
                    aiService.processStreamedResponse(
                        response,
                        token => {
                            chunks.push(token);
                            setState(prev => ({ ...prev, streamedText: chunks.join("") }));
                        },
                        () => {
                            setState(prev => ({ ...prev, isStreaming: false, isComplete: true }));
                            resolve();
                        },
                        streamError => {
                            logger.error("Streaming error:", streamError);
                            reject(streamError);
                        }
                    );
                })
        );

        if (error) {
            setState(prev => ({ ...prev, isStreaming: false }));
            toast.error("Failed to stream response");
            throw error;
        }

        return chunks.join("");
    }, []);

    const abort = useCallback(() => {
        aiService.abortStream();
        setState(prev => ({ ...prev, isStreaming: false }));
    }, []);

    const reset = useCallback(() => {
        setState({ isStreaming: false, streamedText: "", isComplete: false });
    }, []);

    return {
        ...state,
        processStream,
        abort,
        reset
    };
};
