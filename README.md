# The Story Nexus

A powerful AI-driven story writing web application built with Express, React, and TypeScript.

## Overview

The Story Nexus is a local-first web application designed for writers who want to leverage AI to enhance their creative writing process. It provides a comprehensive environment for creating, organizing, and developing stories with the assistance of AI-powered tools. Run it on your local machine or deploy it via Docker to access from any device on your network.

## The Road to Here

Based on [work started by Vijaykumar Bhattacharji](https://github.com/vijayk1989/TheStoryNexusTauriApp); now extensively rewritten, reworked and reimagined.

I wasn't happy with the IndexedDB-based database because I couldn't share data between devices, and I wanted a more robust backend architecture. So I rewrote the backend using Express.js and SQLite with Drizzle ORM.

I didn't like Tauri because I wanted a web app that could run on any device without installing a desktop app, and possibly from a Docker container on my home server. So it was goodbye Tauri.

The code quality has been improved significantly too, and I'm gradually ripping out custom code in favor of established libraries and patterns.

The UI is a writer-first workspace: the manuscript in front, AI machinery behind it.

## Key Features

- **Stories, chapters and series**: chapters with outlines, POV and summaries; stories grouped into series that share a bible
- **Writer-first editor**: Lexical-based, autosaving, with AI woven in rather than bolted on
- **Scene beats with takes**: describe a beat (Alt/Option+S or `/`), generate as many takes as you like, flip between them and accept the best — no generation is ever lost
- **Inline Continue, selection actions and Ask**: greyed ghost continuations you keep or dismiss; rework/expand/shorten/free-form instructions on a selection, from the toolbar or the right-click menu
- **Story bible**: characters, locations, items and more at story, series or global level; extract entries from a chapter, pasted text or the whole story; merge duplicates; continuity checking
- **Brainstorm**: a critical development-editor chat that has read your story; replies become notes, bible entries or chapter outlines
- **Import your manuscript**: .txt, .md, .docx or .epub, single or multi-file, with automatic chapter splitting and clean-up of email/usenet headers and Project Gutenberg boilerplate
- **AI actions, not prompts**: built-in actions with optional per-action overrides (model, sampler settings, template), globally or per story; per-story voice and framing
- **AI providers**: OpenAI, Google Gemini, OpenRouter, or local models (Ollama, LM Studio)
- **Local-first**: everything lives in a SQLite database on your own machine

## Technology Stack

- **Backend**: Express.js, SQLite, Drizzle ORM, better-sqlite3
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **State Management**: TanStack Query v5
- **Routing**: React Router v7
- **Database**: SQLite with Drizzle ORM
- **Text Editor**: Lexical (0.50+)
- **UI Components**: Shadcn UI, Lucide React icons
- **Notifications**: React Toastify
- **Development**: tsx watch (backend), Vite HMR (frontend), concurrently

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn

### Development

1. Clone the repository
2. Install dependencies:
    ```bash
    npm install
    ```
3. Start both backend and frontend servers:

    ```bash
    npm run dev
    ```

    This runs both:
    - Backend API server on `http://localhost:3001`
    - Frontend dev server on `http://localhost:5173` (with proxy to backend)

4. Open `http://localhost:5173` in your browser

### Individual Server Commands

```bash
npm run dev:server   # Backend only (Express + SQLite)
npm run dev:client   # Frontend only (Vite)
```

### Building for Production

1. Build both backend and frontend:

    ```bash
    npm run build
    ```

2. Start production server:

    ```bash
    npm start
    ```

    App runs on `http://localhost:3000` (configurable via `PORT` environment variable)

### Database Management

```bash
npm run db:generate  # Generate migration from schema changes
npm run db:migrate   # Apply migrations to database
```

### Docker Deployment

#### Production (from Docker Hub)

Pull and run the latest published image from [Docker Hub](https://hub.docker.com/r/jonsilver/storynexus):

```bash
docker-compose up -d
```

Supports linux/amd64, linux/arm64, and linux/arm/v7 architectures.

Access on `http://localhost:3000` or from any device on your network using your machine's IP address.

Database persists in `./data/storynexus.db` (mounted volume).

**Version pinning**:

```yaml
# docker-compose.yml
services:
    storynexus:
        image: jonsilver/storynexus:0.6.0 # Pin to specific version
        # or: jonsilver/storynexus:0.6      # Auto-update patches
        # or: jonsilver/storynexus:latest   # Latest release
```

#### Development (local build)

Build and run from source:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

## Release Process

New releases are published via GitHub Releases, which automatically builds and pushes multi-architecture Docker images to Docker Hub.

**Creating a release**:

**Using the PowerShell script (Windows)**:

```powershell
.\release.ps1 patch   # 0.6.0 → 0.6.1
.\release.ps1 minor   # 0.6.0 → 0.7.0
.\release.ps1 major   # 0.6.0 → 1.0.0
```

The script automatically bumps the version, pushes to GitHub, and opens the release page in your browser.

**Manual process**:

1. Bump version: `npm version <patch|minor|major>`
2. Push: `git push && git push --tags`
3. Create GitHub release from the tag (via GitHub UI)

**Result** - Workflow automatically builds and pushes Docker images with tags:

- `jonsilver/storynexus:0.7.0` (specific version)
- `jonsilver/storynexus:0.7` (minor version)
- `jonsilver/storynexus:0` (major version)
- `jonsilver/storynexus:latest`
- `jonsilver/storynexus:sha-abc1234` (commit hash)

**Note**: Docker images are only built on releases, not on every commit to main.

## Screenshots

![App Screenshot](screenshots/Home.jpg)
![App Screenshot](screenshots/Stories.jpg)
![App Screenshot](screenshots/Lorebook.jpg)
![App Screenshot](screenshots/CreateChapter.jpg)
![App Screenshot](screenshots/Editor.jpg)
![App Screenshot](screenshots/SceneBeat.jpg)
![App Screenshot](screenshots/GeneratedProse.jpg)

## Project Structure

### Backend

- `server/` - Express.js API server
    - `db/` - Database schema, client, migrations, and seeding
    - `routes/` - API route handlers (stories, chapters, series, lorebook, notes, brainstorm, ai, actions, generate, ingest, assets, admin)
    - `services/` - Action registry and context assembly, AI providers, manuscript ingest, backups
    - `index.ts` - Server entry point

### Frontend

- `src/v2/` - The app: shell, screens, editor (Lexical composition, nodes, plugins), AI actions, bible flows, export
- `src/features/` - TanStack Query hooks per domain, plus the settings, series, guide and reader pages
- `src/components/` - Shared UI components (Shadcn)
- `src/services/` - API client and AI settings facade
- `src/types/` - TypeScript type definitions
- `src/lib/` - Utility functions and helpers

## Data Management

### Backup (whole database)

**Settings → Backup → Download backup** produces a consistent snapshot of the entire database using SQLite's online backup API — safe to take while you're writing. Images live separately under `data/assets/`; copy that directory too. Don't copy `storynexus.db` on its own while the app is running: the database runs in WAL mode and recent writing may only exist in `storynexus.db-wal`.

### Story backup (JSON)

**Story → Export → JSON (backup)** downloads one story with its chapters, story bible, notes, brainstorm chats, per-story AI overrides and images. Restore it from **Story → Switch story → JSON**; it comes back as a new story titled "… (Imported)", restored all-or-nothing.

### Series backup (JSON)

**Settings → Series** exports and imports a whole series: its series-level bible plus a complete backup of every story in it.

# Roadmap/TODO

- [ ] Replace the component-based guide with markdown-driven documentation presented by a small set of components.
