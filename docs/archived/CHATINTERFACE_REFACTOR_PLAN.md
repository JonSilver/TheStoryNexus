# ChatInterface Refactor Plan

## Executive Summary

ChatInterface has significant architectural issues:

- 40+ action reducer mixing server/UI/derived state
- Imperative data fetching instead of Tanstack Query
- useEffects with ref hacks and dependency issues
- State duplication between props and reducer
- React antipatterns (dispatch during render via microtask)
- Stale closures in async streaming code

**Goal**: Extract custom hooks, use Tanstack Query for server state, eliminate reducer.

---

## Critical Problems

### 1. Dispatch During Render

**File**: `src/features/brainstorm/components/ChatInterface.tsx:44-52`

```typescript
if (prevChatIdRef.current !== selectedChat.id) {
    Promise.resolve().then(() => {
        dispatch({ type: "SET_CURRENT_CHAT_ID", payload: selectedChat.id });
        dispatch({ type: "SET_MESSAGES", payload: selectedChat.messages || [] });
    });
}
```

**Problem**: Executing logic during render, using microtask to defer dispatch. This is a React antipattern.

**Fix**: Don't duplicate `selectedChat.messages` in reducer. Use props directly.

### 2. Server State in Reducer

**File**: `src/features/brainstorm/reducers/chatReducer.ts`

Reducer manages server state that should be in Tanstack Query:

- `messages` - Duplicates `selectedChat.messages` prop
- `currentChatId` - Duplicates `selectedChat.id` prop
- `availableModels` - Fetched data

**Problem**: Dual source of truth. Database has one version, reducer has another.

**Fix**: Server state lives in Tanstack Query cache. Reducer only manages UI state.

### 3. Stale Closures in Streaming

**File**: `src/features/brainstorm/components/ChatInterface.tsx:273-287`

```typescript
() => {
    const updatedMessages = [
        ...state.messages, // Captured at handleSubmit start - STALE
        userMessage,
        { ...assistantMessage, content: fullResponse }
    ];
    updateMutation.mutate({ id: chatId, data: { messages: updatedMessages } });
};
```

**Problem**: `state.messages` is captured when `handleSubmit` starts. If user switches chats mid-stream, this references the wrong chat.

**Fix**: Use `selectedChat.messages` from props (fresh on every render).

### 4. Ref Hacks

**File**: `src/features/brainstorm/components/ChatInterface.tsx:41`

```typescript
const loadedPromptForChatRef = useRef<string | null>(null);
```

**Problem**: Used to prevent effect from running multiple times. Sign of improper state management.

**Fix**: Hook manages loaded state internally with proper memoization.

---

## Proposed Hooks

### 1. usePromptSelection

```typescript
interface UsePromptSelectionReturn {
  selectedPrompt: Prompt | null;
  selectedModel: AllowedModel | null;
  selectPrompt: (prompt: Prompt, model: AllowedModel) => void;
  isLoading: boolean;
}

const usePromptSelection = (
  chatId: string,
  lastUsedPromptId: string | undefined,
  prompts: Prompt[]
): UsePromptSelectionReturn
```

**Responsibilities**:

- Maintains prompt + model selection state
- Loads last used prompt on mount (once)
- Persists changes via mutation
- Returns stable references

**Eliminates**: `loadedPromptForChatRef` hack, 10+ reducer actions

### 2. useAvailableModels

```typescript
const useAvailableModels = () =>
    useQuery({
        queryKey: ["ai", "models"],
        queryFn: async () => {
            await initialize();
            return getAvailableModels();
        },
        staleTime: 5 * 60 * 1000
    });
```

**Responsibilities**:

- Fetches models via Tanstack Query
- Caches for 5 minutes
- Returns loading/error states

**Eliminates**: Imperative fetch effect, reducer action

### 3. usePromptPreview

```typescript
interface UsePromptPreviewReturn {
  showPreview: boolean;
  previewMessages: PromptMessage[] | undefined;
  previewLoading: boolean;
  previewError: string | null;
  openPreview: (config: PromptParserConfig) => Promise<void>;
  closePreview: () => void;
}

const usePromptPreview = (
  parsePrompt: (config: PromptParserConfig) => Promise<ParsedPrompt>
): UsePromptPreviewReturn
```

**Responsibilities**:

- Manages preview modal state
- Handles async prompt parsing
- Returns preview state + control functions

**Eliminates**: 5+ reducer actions for preview state

### 4. useContextSelection

```typescript
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

const useContextSelection = (): UseContextSelectionReturn
```

**Responsibilities**:

- Manages all context selection state
- Clears selections when `includeFullContext` enabled
- Returns all handlers

**Eliminates**: 10+ reducer actions

---

## Streaming State Strategy

**Problem**: Messages stream faster than DB writes. Need local state for UI updates.

**Solution**:

```typescript
const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
const [streamingContent, setStreamingContent] = useState("");

// During streaming:
const displayMessages = streamingMessageId
    ? [...selectedChat.messages, { id: streamingMessageId, content: streamingContent, role: "assistant" }]
    : selectedChat.messages;

// On completion:
await updateMutation.mutate({
    id: chatId,
    data: {
        messages: [
            ...selectedChat.messages, // Use props, not captured state
            userMessage,
            assistantMessage
        ]
    }
});
setStreamingMessageId(null);
setStreamingContent("");
```

**Key Points**:

- Streaming state is local useState
- Base messages from `selectedChat.messages` prop
- Completion handler uses fresh props, not captured state
- Fixes stale closure bug

---

## Migration Steps

### Phase 1: Create Hooks

1. Create `useAvailableModels` in `src/features/ai/hooks/`
2. Create `usePromptSelection` in `src/features/brainstorm/hooks/`
3. Create `usePromptPreview` in `src/features/brainstorm/hooks/`
4. Create `useContextSelection` in `src/features/brainstorm/hooks/`

### Phase 2: Refactor ChatInterface

1. Replace model fetching effect with `useAvailableModels`
2. Replace prompt state with `usePromptSelection`
3. Replace preview state with `usePromptPreview`
4. Replace context state with `useContextSelection`
5. Replace streaming with local useState + props
6. Remove all reducer dispatches
7. Use `selectedChat.messages` directly from props
8. Update event handlers to use hook functions

### Phase 3: Cleanup

1. Delete `chatReducer.ts`
2. Remove refs: `prevChatIdRef`, `loadedPromptForChatRef`
3. Keep `editingTextareaRef` (legitimate focus management)

### Phase 4: Testing

Test these scenarios:

- Switch chat → prompt loads correctly
- Switch chat → messages reset
- Switch mid-stream → saves to correct chat
- Send message → streams correctly
- Abort stream → stops cleanly
- Edit message → saves to DB
- Preview prompt → modal opens
- Select context → included in generation

---

## Bug Fixes

### Dispatch During Render

**Before**: `Promise.resolve().then(dispatch)`
**After**: Don't duplicate props in state. Use `selectedChat.messages` directly.

### Stale Closure

**Before**: `const updatedMessages = [...state.messages, ...]` (captured)
**After**: `const updatedMessages = [...selectedChat.messages, ...]` (fresh)

### Infinite Loop

**Before**: `loadedPromptForChatRef` prevents re-running effect
**After**: Hook manages loaded state internally with proper dependencies

### Unstable References

**Before**: Effect depends on `getAvailableModels` (Zustand function)
**After**: Tanstack Query hook with stable reference

---

## Files Changed

**Created**:

- `src/features/ai/hooks/useAvailableModels.ts`
- `src/features/brainstorm/hooks/usePromptSelection.ts`
- `src/features/brainstorm/hooks/usePromptPreview.ts`
- `src/features/brainstorm/hooks/useContextSelection.ts`

**Modified**:

- `src/features/brainstorm/components/ChatInterface.tsx`

**Deleted**:

- `src/features/brainstorm/reducers/chatReducer.ts`
