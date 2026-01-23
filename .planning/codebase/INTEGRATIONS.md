# External Integrations

**Analysis Date:** 2026-01-23

## APIs & External Services

**AI Providers:**
- OpenAI - LLM API for text generation
  - SDK: `openai` v6.10
  - Auth: API key stored in `aiSettings.openaiKey`
  - Implementation: `src/services/ai/providers/OpenAIProvider.ts`
  - Supports streaming chat completions
  - Default model setting: `aiSettings.defaultOpenAIModel`

- Google Gemini - Google's LLM API
  - SDK: `@google/genai` v1.34
  - Auth: API key stored in `aiSettings.geminiKey`
  - Implementation: `src/services/ai/providers/GeminiProvider.ts`
  - Supports streaming responses
  - Default model setting: `aiSettings.defaultGeminiModel`

- OpenRouter - LLM aggregator API
  - Base URL: `https://openrouter.ai/api/v1`
  - SDK: `openai` v6.10 (compatible)
  - Auth: API key stored in `aiSettings.openrouterKey`
  - Implementation: `src/services/ai/providers/OpenRouterProvider.ts`
  - Requires HTTP-Referer header: `http://localhost:5173`
  - Default model setting: `aiSettings.defaultOpenRouterModel`

- Local AI (LM Studio Compatible) - Self-hosted models
  - Default endpoint: `http://localhost:1234/v1` (configurable via `aiSettings.localApiUrl`)
  - SDK: Custom fetch implementation
  - Auth: None required
  - Implementation: `src/services/ai/providers/LocalAIProvider.ts`
  - Expects OpenAI-compatible API format
  - Model discovery via `/models` endpoint
  - Default model setting: `aiSettings.defaultLocalModel`

**AI Service Architecture:**
- Singleton: `AIService` (`src/services/ai/AIService.ts`)
- Factory pattern: `AIProviderFactory` manages four provider instances
- Streaming support: `processStreamedResponse()` handles response streaming
- Token counting: `gpt-tokenizer` for prompt size estimation

## Data Storage

**Database:**
- **SQLite** (Local embedded)
  - File-based: `storynexus.db` (default path: `./data/storynexus.db`)
  - Configurable: `DATABASE_PATH` environment variable
  - WAL mode enabled for concurrency
  - Client: `better-sqlite3` native driver
  - ORM: Drizzle ORM v0.45
  - Schema: `server/db/schema.ts`
  - Migrations: Generated via Drizzle Kit, stored in `server/db/migrations/`

**Tables:**
- `series` - Series grouping metadata
- `stories` - Story metadata, synopsis, optional series link
- `chapters` - Chapter content (Lexical JSON), outline, POV, word count
- `aiChats` - Brainstorm/AI conversation history
- `prompts` - System and user-defined prompts with variants
- `aiSettings` - API keys, model availability, provider configurations
- `lorebookEntries` - Characters, locations, items, events (hierarchical: global/series/story)
- `sceneBeats` - Inline writing commands with generated content
- `notes` - Story notes (ideas, research, todos)

**File Storage:**
- Local filesystem only (no cloud storage)
- File uploads handled via Multer v2.0
- Import/export functionality for JSON files (prompts, lorebook)
- Export formats: PDF (jspdf), EPUB (epub-gen-memory), JSON

## Authentication & Identity

**Auth Provider:**
- None built-in
- Single-user, local-first application (no authentication layer)
- All data stored locally on user's machine

**API Key Management:**
- Keys stored in SQLite `aiSettings` table
- Server-side storage via API endpoint: `PUT /api/ai/settings/:id`
- Frontend retrieves settings via `GET /api/ai/settings`

## Monitoring & Observability

**Error Tracking:**
- None configured
- Local logging via `loglevel` package

**Logs:**
- Browser console logging (frontend)
- Server console logging (backend)
- Logger utility: `src/utils/logger.ts`
- Log levels: info, warn, error

## CI/CD & Deployment

**Hosting Options:**
- Local development: `npm run dev` (dual servers)
- Docker containerization: `docker-compose up --build`
- Docker image: Node.js 22 Alpine with native module support
- Production single-server setup: `npm start` on port 3000

**CI Pipeline:**
- None configured (manual deployment)
- Local linting: `npm run lint` (OxLint)
- Local type checking: `tsc`
- Local formatting: `npm run format` (Prettier)

**Docker Setup:**
- `Dockerfile` - Multi-stage build (builder + production)
- `docker-compose.yml` - Production configuration
- `docker-compose.dev.yml` - Development configuration
- `docker-compose.prod.yml` - Production-specific configuration
- `.dockerignore` - Build optimization
- Database volume: `/app/data` (persistent)
- Port mapping: 3000 (configurable via `APP_PORT`)
- User support: PUID/PGID environment variables for permission mapping
- Health check: HTTP endpoint `/api/health`

## Environment Configuration

**Required env vars (Optional - all have defaults):**
- `NODE_ENV` - Set to `development` or `production`
- `PORT` - Server port (default: 3000)
- `DATABASE_PATH` - SQLite database file path
- `DOCKER_IMAGE` - Docker image name (docker-compose only)
- `IMAGE_TAG` - Docker image tag (docker-compose only)
- `APP_PORT` - Mapped Docker port (docker-compose only)
- `DATA_PATH` - Host path for Docker volume (docker-compose only)
- `PUID` / `PGID` - Docker user/group IDs (docker-compose only)

**Secrets Location:**
- AI API keys entered via UI, stored in `aiSettings` SQLite table
- No `.env` file required (local-first design)
- Docker env vars via `docker-compose.yml`

**Configuration Files:**
- `.env.production.example` - Docker configuration template
- `drizzle.config.ts` - Database configuration
- `vite.config.ts` - Frontend build configuration
- `tsconfig.json` - TypeScript configuration

## Webhooks & Callbacks

**Incoming:**
- None configured
- No external webhook support

**Outgoing:**
- None configured
- All external API calls are request/response (OpenAI, Gemini, OpenRouter, LocalAI)
- No background job/message queue system

## API Endpoints (Backend)

**Main API Routes:**
- `GET/POST /api/series` - Series management
- `GET/POST /api/stories` - Story management
- `GET/POST /api/chapters` - Chapter management
- `GET/POST /api/lorebook` - Lorebook entry management
- `GET/POST /api/prompts` - Prompt management
- `GET/PUT /api/ai/settings` - AI provider configuration
- `GET/POST /api/brainstorm` - AI chat history
- `GET/POST /api/scenebeats` - Scene beat commands
- `GET/POST /api/notes` - Story notes
- `GET /api/admin` - Admin operations (migrations, seeding)
- `GET /api/health` - Health check endpoint

**Frontend API Client:**
- Located: `src/services/api/client.ts`
- Pattern: Typed API object exports for each domain
- Methods: `storiesApi`, `seriesApi`, `chaptersApi`, `lorebookApi`, `promptsApi`, `aiApi`, `brainstormApi`, `scenebeatsApi`, `notesApi`
- Underlying: `fetchJSON()` and `uploadFile()` helpers with Zod validation

## Network Configuration

**Development:**
- Backend: `http://localhost:3001`
- Frontend: `http://localhost:5173`
- Vite proxy: `/api` → backend (auto-proxied in dev)
- CORS enabled in development mode

**Production:**
- Single origin: `http://localhost:3000` (or configured `PORT`)
- Static frontend served from Express
- API routes under `/api/*`
- CORS disabled in production

---

*Integration audit: 2026-01-23*
