# Coding Conventions

**Analysis Date:** 2026-01-23

## Naming Patterns

**Files:**
- Components: PascalCase (`ErrorBoundary.tsx`, `StoryReader.tsx`, `MainLayout.tsx`)
- Utilities and services: camelCase (`logger.ts`, `promptParser.ts`, `aiGenerationHelper.ts`)
- Types: camelCase with suffix (`story.ts` for types, `entities.ts` for schemas)
- Hooks: camelCase with `use` prefix (`useStoriesQuery.ts`, `useSceneBeatGeneration.ts`)
- Contexts: PascalCase with `Context` suffix (`StoryContext.tsx`, `WorkspaceContext.tsx`)
- Config files: camelCase with dot notation (`appSettings.ts`, `drizzle.config.ts`)

**Functions:**
- Arrow functions preferred throughout codebase
- camelCase for all function names
- Avoid `function` keyword; use `const name = () => {}`
- Hooks exported as named exports with leading underscore if private utility: `export const useStoriesQuery = () => ...`
- Factory/provider methods: camelCase (`initializeProvider`, `fetchModels`, `getProvider`)
- Service methods: camelCase with verb prefix (`createCrudRouter`, `generateWithLocalModel`, `updateKey`)

**Variables:**
- `const` only—never `let` or `var` (enforced via linting)
- camelCase for all variables
- Prefix private/internal variables with underscore: `_internalState`
- Query key objects use constant pattern:
  ```typescript
  const storiesKeys = {
      all: ["stories"] as const,
      detail: (id: string) => ["stories", id] as const
  };
  ```

**Types:**
- Interfaces for object types: `interface ErrorBoundaryProps { ... }`
- Type aliases for unions/primitives: `type AIProvider = "openai" | "openrouter" | "local" | "gemini"`
- Prefix interfaces with component/context name if local: `interface ErrorBoundaryProps`, `interface PromptParserDependencies`
- Base interfaces use `Base` prefix: `BaseEntity` contains `id`, `createdAt`, `isDemo?`
- PascalCase for all type names

## Code Style

**Formatting:**
- **Tool:** Prettier (configured via `.prettierrc`)
- **Tab width:** 4 spaces (not tabs)
- **Line length:** 120 characters
- **Quotes:** Double quotes for strings (not single)
- **Semicolons:** Required (semi: true)
- **Trailing commas:** None (trailingComma: "none")
- **Arrow parens:** Avoided where possible (arrowParens: "avoid")
  ```typescript
  // Preferred
  const fn = x => x * 2;
  const fn = (x, y) => x + y;  // Parens required for multiple params
  ```
- **Bracket spacing:** Enabled (`{ key: value }`)

**Linting:**
- **Tool:** OxLint (configured via `.oxlintrc.json`)
- **Key rules:**
  - `no-explicit-any`: error—all types must be explicit
  - `no-unused-vars`: warn—unused variables flagged
  - `prefer-arrow-callback`: error—arrow functions required in callbacks
  - `react-hooks/rules-of-hooks`: error—React hook rules enforced
  - `react-hooks/exhaustive-deps`: warn—dependency arrays checked
  - `max-lines`: warn—250 lines per file (400 for server files)
  - `react/jsx-key`: error—keys required in lists
  - `curly`: warn (multi)—braces required where multiple statements exist
  - `no-non-null-assertion`: warn—avoid `!` operator where possible

## Import Organization

**Order:**
1. External libraries (React, utilities, Radix UI, TanStack, etc.)
2. Type imports: `import type { ... }`
3. Internal modules from `@/` path alias
4. Relative imports: `./` and `../`
5. Style imports: CSS files

**Path Aliases:**
- `@/*` → `./src/*` (frontend)
- `shared/*` → `src/Lexical/shared/src/*` (Lexical editor utilities)

**Example:**
```typescript
import { attemptPromise } from "@jfdi/attempt";
import is from "@sindresorhus/is";
import { useCallback, useState } from "react";
import { toast } from "react-toastify";
import type { AllowedModel, PromptMessage } from "@/types/story";
import { useGenerateWithPrompt } from "@/features/ai/hooks/useGenerateWithPrompt";
import { logger } from "@/utils/logger";
```

## Error Handling

**Pattern:**
- Use `@jfdi/attempt` library for functional error handling—never raw try/catch
- `attempt()` for synchronous operations; `attemptPromise()` for async

**Synchronous example:**
```typescript
import { attempt } from "@jfdi/attempt";

const [error] = attempt(() => {
    // operation that may throw
});
if (error) return handleError(error);
```

**Asynchronous example:**
```typescript
import { attemptPromise } from "@jfdi/attempt";

const [error, result] = await attemptPromise(async () => {
    return await fetchData();
});
if (error) {
    logger.error("Failed to fetch:", error);
    return;
}
// use result
```

**When to add error handling:**
- Only where error is likely recoverable (API calls, parsing, validation)
- Unhandled exceptions fall back to global error boundary
- Logging: use `logger.error()` not `console.error()`

**Error boundary pattern** (`src/components/ErrorBoundary.tsx`):
- Wraps component trees to catch React render errors
- Logs via `logger.error()`
- Displays user-friendly error message with recovery actions

## Logging

**Framework:** `loglevel` (via `src/utils/logger.ts`)

**Configuration:**
- Dev environment: debug level
- Prod environment: warn level
- Accessed as `logger` not `console`

**Patterns:**
```typescript
import { logger } from "@/utils/logger";

logger.debug("[ModuleName] Detailed message");
logger.info("[ModuleName] Info message");
logger.warn("[ModuleName] Warning message");
logger.error("[ModuleName] Error message", error);
```

**Convention:**
- Prefix all logs with module name in brackets: `[AIService]`, `[PromptParser]`
- Use lowercase message text
- Include error objects in error logs for debugging

## Comments

**When to comment:**
- Explain *why*, not *what*—code should be self-documenting
- Complex algorithmic logic that isn't obvious
- Non-standard patterns or workarounds
- Publicly exported functions/types

**Avoid:**
- Commenting obvious code: `const name = "John"; // Set name`
- Outdated comments that describe old behavior
- Excessive inline comments breaking code flow

**JSDoc/TSDoc:**
- Not required for internal functions
- Recommended for exported service/utility functions
- Example:
  ```typescript
  /**
   * Parse a prompt template with variable substitution.
   * @param config Configuration including prompt template and context
   * @returns Parsed prompt with substituted variables and error state
   */
  export const parsePrompt = (config: PromptParserConfig): ParsedPrompt => { ... }
  ```

## Function Design

**Size:**
- Keep functions under 250 lines (enforced by linting)
- Break large functions into smaller, named utilities
- Server files allow up to 400 lines (complex CRUD routers)

**Parameters:**
- Prefer object parameters over multiple positional args
- Use destructuring: `const { id, data } = params`
- Provide types for all parameters: `(id: string, data: Partial<Story>)`

**Return Values:**
- Always annotate return type: `(config: PromptParserConfig): ParsedPrompt => { ... }`
- Use explicit return, not implicit
- Single responsibility—each function does one thing well

## Module Design

**Exports:**
- Named exports preferred for functions and types
- Default exports only for page/route components
- Barrel files (`index.ts`) export public API only

**Example barrel file** (`src/features/prompts/services/resolvers/index.ts`):
```typescript
export { ChapterSummariesResolver } from "./ChapterResolvers";
export { AllCharactersResolver } from "./LorebookResolvers";
export { VariableResolverRegistry } from "./VariableResolverRegistry";
// ... other exports
```

**File organization:**
- `/hooks/` - Custom React hooks for data/state
- `/services/` - Business logic classes/functions
- `/components/` - React components
- `/pages/` - Page/route components
- `/types/` - Type definitions for feature
- `/utils/` - Utility functions

## Special Patterns

**Singleton pattern** (used for `AIService`):
```typescript
export class AIService {
    private static instance: AIService;

    private constructor() { ... }

    static getInstance(): AIService {
        if (!AIService.instance)
            AIService.instance = new AIService();
        return AIService.instance;
    }
}
```

**Factory pattern** (used for `AIProviderFactory`):
- Encapsulates provider instantiation logic
- Single method signature: `getProvider(type): ProviderInstance`
- Avoids conditional branching at call sites

**Higher-order functions:**
- Used for creating specialized hooks and utilities
- Example: `createCrudRouter` factory in `server/lib/crud.ts`

**Data-driven type derivation:**
- Prefer iterating over data structures vs. switch statements
- Build type maps from configuration objects
- Index into maps for behavior selection

---

*Convention analysis: 2026-01-23*
