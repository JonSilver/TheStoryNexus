# Add Google Gemini Provider (Issue #45)

## Summary

Add Google Gemini as a fourth AI provider, following existing provider patterns.

## Files to Modify

### 1. Package Installation

- `package.json` - Add `@google/genai` dependency

### 2. Types & Schemas

- `src/types/story.ts:115` - Add `"gemini"` to `AIProvider` union
- `src/types/story.ts:125-134` - Add to `AISettings` interface:
    - `geminiKey?: string`
    - `defaultGeminiModel?: string`
- `src/schemas/entities.ts:191` - Add `"gemini"` to `aiProviderSchema` enum
- `src/schemas/entities.ts:200-209` - Add to `aiSettingsSchema`:
    - `geminiKey: z.string().optional()`
    - `defaultGeminiModel: z.string().optional()`

### 3. Database

- `server/db/schema.ts:114-125` - Add columns to `aiSettings` table:
    - `geminiKey: text("geminiKey")`
    - `defaultGeminiModel: text("defaultGeminiModel")`
- Run `npm run db:generate` then `npm run db:migrate`

### 4. New Provider Class

- `src/services/ai/providers/GeminiProvider.ts` (new file) implementing `IAIProvider`:
    - `initialize(apiKey)` - Create `GoogleGenAI` client with `dangerouslyAllowBrowser: true`
    - `fetchModels()` - Call `client.models.list()`, filter to models supporting `generateContent`, map to `AIModel[]` with `inputTokenLimit` as contextLength
    - `generate(messages, model, temperature, maxTokens, signal)` - Convert messages, call `generateContentStream`, wrap response
    - `isInitialized()` - Return `client !== null`
- `src/services/ai/streamUtils.ts` - Add `wrapGeminiStream()` function:
    - Extract text via `chunk.text()` (different from OpenAI's nested structure)
    - Create ReadableStream matching existing pattern
- `src/services/ai/providers/index.ts` - Add `export * from "./GeminiProvider"`

### 5. Service Integration

- `src/services/ai/AIProviderFactory.ts:11` - Add to constructor:
    - `this.providers.set("gemini", new GeminiProvider())`
- `src/services/ai/AIService.ts`:
    - Line 41-49 `initialize()` - Add: `if (this.settings.geminiKey) { this.providerFactory.initializeProvider("gemini", this.settings.geminiKey); }`
    - Line 57-60 `updateKey()` - Add to spread: `...(provider === "gemini" && { geminiKey: key })`
    - Add new method `generateWithGemini()` following `generateWithOpenAI()` pattern (lines 205-225)
    - Line 332-355 - Add getter `getGeminiKey(): string | undefined`
    - Line 345-355 - Add getter `getDefaultGeminiModel(): string | undefined`
    - Line 357-371 `updateDefaultModel()` - Add case: `else if (provider === "gemini") { updateData = { defaultGeminiModel: modelId }; }`
- `src/features/ai/services/aiGenerationHelper.ts:23-49` - Add case to switch:

    ```typescript
    case "gemini":
        return aiService.generateWithGemini(messages, modelId, temperature, maxTokens);
    ```

### 6. Frontend UI

- `src/features/ai/hooks/useAISettingsQuery.ts:133-139` - Add to `providerName` record:
    - `gemini: "Gemini"`
- `src/features/ai/pages/SettingsPage.tsx`:
    - Line 145 - Add: `const geminiModels = allModels.filter(m => m.provider === "gemini");`
    - After line 193 (OpenRouter card) - Add new `ProviderCard`:

        ```tsx
        <ProviderCard
            provider="gemini"
            title="Google Gemini Configuration"
            keyLabel="Gemini API Key"
            keyPlaceholder="Enter your Gemini API key"
            storedKey={settings?.geminiKey}
            models={geminiModels}
            defaultModel={settings?.defaultGeminiModel}
            isKeyMutating={updateKeyMutation.isPending}
            isRefreshing={refreshModelsMutation.isPending}
            onSaveKey={key => updateKeyMutation.mutate({ provider: "gemini", key })}
            onRefresh={() => refreshModelsMutation.mutate("gemini")}
            onDefaultModelChange={modelId => updateDefaultModelMutation.mutate({ provider: "gemini", modelId })}
        />
        ```

## Key Implementation Details

### Gemini SDK API

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "KEY" });

// Streaming generation
const response = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: [
        { role: "user", parts: [{ text: "Hello" }] },
        { role: "model", parts: [{ text: "Hi there" }] },
        { role: "user", parts: [{ text: "Next message" }] }
    ],
    config: {
        systemInstruction: "System prompt here",
        temperature: 0.7,
        maxOutputTokens: 2048
    }
});
for await (const chunk of response) {
    console.log(chunk.text);
}
```

### Message Format Conversion (in GeminiProvider)

Convert `PromptMessage[]` to Gemini `contents` format:

- `role: "assistant"` -> `role: "model"`
- `role: "system"` -> Extract and pass via `config.systemInstruction`
- `content: string` -> `parts: [{ text: content }]`

### Model Fetching

Use `ai.models` API (need to verify exact method during implementation - likely iterate or list).

### Stream Wrapper

Gemini chunks expose `.text` property directly vs OpenAI's `choices[0].delta.content`.

### AbortSignal

SDK support unclear from docs - may need to handle at stream iteration level or check SDK source during implementation.

## Verification

- `npm run lint`
- `npm run build`
- Manual test: Add Gemini API key, verify models appear, test generation
