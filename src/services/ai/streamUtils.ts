import { attemptPromise } from "@jfdi/attempt";
import type { GenerateContentResponse } from "@google/genai";

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
