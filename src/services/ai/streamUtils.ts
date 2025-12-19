import { attemptPromise } from "@jfdi/attempt";
import type { GenerateContentResponse } from "@google/genai";
import { formatSSEChunk, formatSSEDone } from "@/constants/aiConstants";
import { logger } from "@/utils/logger";

interface ChatCompletionChunk {
    choices: Array<{
        delta?: {
            content?: string | null;
        };
    }>;
}

/**
 * Wraps an OpenAI-compatible async streaming response into a Web API Response with ReadableStream.
 */
export const wrapOpenAIStream = async (stream: AsyncIterable<ChatCompletionChunk>): Promise<Response> =>
    new Response(
        new ReadableStream({
            async start(controller) {
                const [error] = await attemptPromise(async () => {
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content;
                        if (content)
                            controller.enqueue(new TextEncoder().encode(content));

                    }
                });

                if (error)
                    controller.error(error);
                 else
                    controller.close();

            }
        })
    );

/**
 * Wraps a Gemini streaming response into a Web API Response with ReadableStream.
 */
export const wrapGeminiStream = async (
    stream: AsyncGenerator<GenerateContentResponse>
): Promise<Response> =>
    new Response(
        new ReadableStream({
            async start(controller) {
                const [error] = await attemptPromise(async () => {
                    for await (const chunk of stream) {
                        const content = chunk.text;
                        if (content)
                            controller.enqueue(new TextEncoder().encode(content));

                    }
                });

                if (error)
                    controller.error(error);
                 else
                    controller.close();

            }
        })
    );

/**
 * Formats a raw streaming response into SSE format.
 */
export const formatStreamAsSSE = (response: Response): Response => {
    const responseStream = new ReadableStream({
        async start(controller) {
            if (!response.body) {
                controller.close();
                return;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            const [error] = await attemptPromise(async () => {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    const content = decoder.decode(value, { stream: true });
                    const formattedChunk = formatSSEChunk(content);

                    controller.enqueue(new TextEncoder().encode(formattedChunk));
                }
                controller.enqueue(new TextEncoder().encode(formatSSEDone()));
            });

            if (error)
                if ((error as Error).name === "AbortError") controller.close();
                else controller.error(error);
            else controller.close();
        }
    });

    return new Response(responseStream, {
        headers: { "Content-Type": "text/event-stream" }
    });
};

/**
 * Processes an SSE stream, invoking callbacks for tokens, completion, and errors.
 */
export const processStreamedResponse = async (
    response: Response,
    onToken: (text: string) => void,
    onComplete: () => void,
    onError: (error: Error) => void
): Promise<void> => {
    if (!response.body) return onError(new Error("Response body is null"));

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const [error] = await attemptPromise(async () => {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                onComplete();
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter(line => line.trim() !== "");

            for (const line of lines)
                if (line.startsWith("data: ")) {
                    const data = line.substring(6);
                    if (data === "[DONE]") {
                        onComplete();
                        return;
                    }
                    const [parseError, json] = await attemptPromise(() => Promise.resolve(JSON.parse(data)));
                    if (!parseError && json) {
                        const text = json.choices[0]?.delta?.content || "";
                        if (text) onToken(text);
                    }
                }
        }
    });

    if (error)
        if ((error as Error).name === "AbortError") {
            logger.info("Stream reading aborted.");
            onComplete();
        } else onError(error as Error);
};
