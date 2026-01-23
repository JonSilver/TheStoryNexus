# Testing Patterns

**Analysis Date:** 2026-01-23

## Test Framework

**Status:** Not detected

This codebase does not currently have a configured test runner (Jest, Vitest, etc.) or test files in the source tree. No `jest.config.js`, `vitest.config.ts`, or test files (*.test.ts, *.test.tsx, *.spec.ts, *.spec.tsx) exist in `src/` or `server/` directories.

**Development Setup:**
- **Runner:** None configured
- **Assertion Library:** None configured
- **Run Commands:** No test scripts in `package.json`

## Test Coverage

**Requirements:** Not enforced

No coverage thresholds or coverage configuration present. Code quality relies on:
- OxLint for static analysis
- TypeScript strict checks
- Prettier for code consistency
- Manual review and testing

## Testing Strategy (Current)

While automated tests are not present, the codebase follows patterns that support testability:

**Error Handling via @jfdi/attempt:**
- Functional error handling makes async/sync boundaries explicit and testable
- Return tuples `[error, result]` enable deterministic error assertions
- Example testable pattern:
  ```typescript
  const [error, result] = await attemptPromise(async () => {
      return await fetchData();
  });
  // Easy to assert: expect(error).toBeDefined() or expect(result).toBeDefined()
  ```

**Type System as Test:**
- Strict TypeScript settings enforce type safety at compile time
- Type mismatches caught before runtime
- Interfaces (`ErrorBoundaryProps`, `PromptParserConfig`) document contracts

**API Client Abstraction** (`src/services/api/client.ts`):
- Centralized API calls via factory pattern
- Easy to mock/stub for testing
- Example structure allows dependency injection for tests

**TanStack Query Hooks** (`src/features/*/hooks/useXQuery.ts`):
- Query keys are constants—easy to validate and control
- Mutations include callbacks—testable side effects
- Cache invalidation explicit and traceable

## Recommended Test Structure (When Adding Tests)

**Test file location:**
- Co-located with implementation: `src/components/ErrorBoundary.tsx` → `src/components/ErrorBoundary.test.tsx`
- Feature tests: `src/features/stories/hooks/__tests__/useStoriesQuery.test.ts`

**Test naming pattern:**
- Describe component/function: `describe("ErrorBoundary", () => { ... })`
- Describe behavior: `it("renders error message when child component throws", () => { ... })`

**Structure template:**
```typescript
import { render, screen } from "@testing-library/react";  // if React Testing Library chosen
import { ErrorBoundary } from "./ErrorBoundary";

describe("ErrorBoundary", () => {
    it("displays fallback UI when child throws", () => {
        const ThrowingComponent = () => {
            throw new Error("Test error");
        };

        render(
            <ErrorBoundary>
                <ThrowingComponent />
            </ErrorBoundary>
        );

        expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("resets error boundary on retry click", () => {
        // test implementation
    });
});
```

## Mocking Strategy (When Adding Tests)

**What to mock:**
- API calls (fetch, axios interceptors)
- TanStack Query client and hooks
- External libraries (OpenAI SDK, Google GenAI SDK)
- File system operations (in Node.js tests)

**What NOT to mock:**
- Business logic functions (they should be tested, not mocked)
- Internal component behavior
- React hooks from React (test actual behavior)
- Type utilities and helpers

**Mocking pattern for API calls:**
```typescript
import { vi } from "vitest";  // or jest
import { storiesApi } from "@/services/api/client";

vi.mock("@/services/api/client", () => ({
    storiesApi: {
        getAll: vi.fn().mockResolvedValue([...]),
        create: vi.fn().mockResolvedValue({ id: "123", ... })
    }
}));
```

**Mocking pattern for hooks:**
```typescript
import { useQuery } from "@tanstack/react-query";

vi.mock("@tanstack/react-query", () => ({
    useQuery: vi.fn().mockReturnValue({
        data: mockData,
        isLoading: false,
        error: null
    })
}));
```

## Unit Testing Approach (When Adding Tests)

**Service/utility functions:**
```typescript
import { PromptParser } from "@/features/prompts/services/promptParser";

describe("PromptParser", () => {
    const mockEntries = [ /* test data */ ];
    let parser: PromptParser;

    beforeEach(() => {
        parser = new PromptParser({ entries: mockEntries });
    });

    it("substitutes variables in prompt template", async () => {
        const config = { promptId: "test", ... };
        const result = await parser.parse(config);

        expect(result.messages).toHaveLength(2);
        expect(result.messages[0].content).toContain("substituted value");
    });

    it("returns error state for invalid template", async () => {
        const config = { promptId: "invalid", ... };
        const result = await parser.parse(config);

        expect(result.error).toBeDefined();
        expect(result.error).toMatch(/invalid syntax/i);
    });
});
```

**Hook testing pattern:**
```typescript
import { renderHook, act } from "@testing-library/react";  // React Testing Library
import { useStoriesQuery } from "@/features/stories/hooks/useStoriesQuery";

describe("useStoriesQuery", () => {
    it("fetches stories on mount", async () => {
        const { result } = renderHook(() => useStoriesQuery());

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.data).toEqual(mockStories);
    });

    it("handles fetch error", async () => {
        // Mock api.getAll to reject
        const { result } = renderHook(() => useStoriesQuery());

        await waitFor(() => {
            expect(result.current.error).toBeDefined();
        });
    });
});
```

## Integration Testing Approach (When Adding Tests)

**Component integration** (with context/providers):
```typescript
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { StoryProvider } from "@/features/stories/context/StoryContext";

describe("Story editor integration", () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false }
        }
    });

    const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <ErrorBoundary>
                <StoryProvider>
                    {children}
                </StoryProvider>
            </ErrorBoundary>
        </QueryClientProvider>
    );

    it("creates and edits a story", async () => {
        const user = userEvent.setup();
        render(<StoryEditor />, { wrapper: Wrapper });

        const titleInput = screen.getByLabelText(/story title/i);
        await user.type(titleInput, "My Story");

        const saveButton = screen.getByRole("button", { name: /save/i });
        await user.click(saveButton);

        await screen.findByText("Story created successfully");
    });
});
```

**API route testing** (server-side):
```typescript
import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import app from "@/server/index";
import { db, schema } from "@/server/db/client";

describe("POST /api/stories", () => {
    beforeEach(async () => {
        // Clear database or setup test data
    });

    it("creates a new story", async () => {
        const response = await request(app)
            .post("/api/stories")
            .send({
                title: "Test Story",
                author: "Test Author",
                language: "English"
            })
            .expect(201);

        expect(response.body.id).toBeDefined();
        expect(response.body.title).toBe("Test Story");
    });

    it("rejects invalid input", async () => {
        const response = await request(app)
            .post("/api/stories")
            .send({ title: "" })  // Missing required fields
            .expect(400);

        expect(response.body.error).toBeDefined();
    });
});
```

## Async Testing Patterns (When Adding Tests)

**Promise-based async:**
```typescript
it("handles async operation", async () => {
    const promise = asyncFunction();
    expect(promise).toBeInstanceOf(Promise);

    const result = await promise;
    expect(result).toEqual(expectedValue);
});
```

**Await with timeout:**
```typescript
it("waits for async state update", async () => {
    render(<Component />);

    await waitFor(() => {
        expect(screen.getByText("Loaded")).toBeInTheDocument();
    }, { timeout: 3000 });
});
```

**With @jfdi/attempt:**
```typescript
it("handles attempt result tuple", async () => {
    const [error, result] = await attemptPromise(async () => {
        return await aiService.generateWithPrompt(config);
    });

    if (error) {
        expect(error).toBeInstanceOf(Error);
    } else {
        expect(result).toBeDefined();
    }
});
```

## Error Testing Patterns (When Adding Tests)

**Error boundary:**
```typescript
it("catches and displays errors", () => {
    const ErrorComponent = () => {
        throw new Error("Render error");
    };

    // Suppress console.error for this test
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
        <ErrorBoundary>
            <ErrorComponent />
        </ErrorBoundary>
    );

    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    spy.mockRestore();
});
```

**API error response:**
```typescript
it("handles API error", async () => {
    const [error] = await attemptPromise(async () => {
        return await storiesApi.getById("invalid-id");
    });

    expect(error).toBeDefined();
    expect(error?.message).toMatch(/not found|404/i);
});
```

**Validation error:**
```typescript
it("validates input before processing", async () => {
    const schema = z.object({ title: z.string().min(1) });
    const result = schema.safeParse({ title: "" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toMatch(/at least 1 character/i);
});
```

## Test Data & Fixtures (When Adding Tests)

**Factory pattern:**
```typescript
// __tests__/factories/storyFactory.ts
export const createStory = (overrides?: Partial<Story>): Story => ({
    id: nanoid(),
    createdAt: new Date(),
    title: "Test Story",
    author: "Test Author",
    language: "English",
    ...overrides
});

export const createChapter = (overrides?: Partial<Chapter>): Chapter => ({
    id: nanoid(),
    storyId: "test-story",
    createdAt: new Date(),
    title: "Chapter 1",
    order: 1,
    content: "Test content",
    wordCount: 100,
    ...overrides
});
```

**Usage in tests:**
```typescript
it("displays story chapters", () => {
    const story = createStory();
    const chapters = [
        createChapter({ storyId: story.id, order: 1 }),
        createChapter({ storyId: story.id, order: 2 })
    ];

    render(<ChapterList chapters={chapters} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
});
```

## Test Configuration Recommendations

If tests are added in future, recommended setup:

**Package.json scripts:**
```json
{
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage"
}
```

**vitest.config.ts:**
```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", "dist/"]
        }
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src")
        }
    }
});
```

## Current Code Quality Measures

While testing framework is not present, code quality is maintained via:

1. **TypeScript strict checks** (`noImplicitAny`, `strictNullChecks`, `noImplicitReturns`)
2. **OxLint static analysis** (250-line file limit, exhaustive deps, no unused vars)
3. **Prettier formatting** (consistent style, no manual formatting debate)
4. **Type-driven error handling** (attempt pattern makes errors explicit)
5. **Feature-based architecture** (low coupling between domains)
6. **API abstraction layer** (easy to mock/stub when testing needed)

---

*Testing analysis: 2026-01-23*
