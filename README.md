# The Story Nexus

A powerful AI-driven story writing web application built with Express, React, and TypeScript.

## Overview

The Story Nexus is a local-first web application designed for writers who want to leverage AI to enhance their creative writing process. It provides a comprehensive environment for creating, organizing, and developing stories with the assistance of AI-powered tools. Run it on your local machine or deploy it via Docker to access from any device on your network.

## The Road to Here

Based on [work started by Vijaykumar Bhattacharji](https://github.com/vijayk1989/TheStoryNexusTauriApp); now extensively rewritten, reworked and reimagined.

I wasn't happy with the IndexedDB-based database because I couldn't share data between devices, and I wanted a more robust backend architecture. So I rewrote the backend using Express.js and SQLite with Drizzle ORM.

I didn't like Tauri because I wanted a web app that could run on any device without installing a desktop app, and possibly from a Docker container on my home server. So it was goodbye Tauri.

The code quality has been improved significantly too, and I'm gradually ripping out custom code in favor of established libraries and patterns.

I'm also in the process of reworking the UI/UX to be more of a writer's workspace.

## Key Features

- **Story Management**: Create and organize your stories with chapters, outlines, and summaries
- **Rich Text Editor**: Write and edit your stories using a powerful Lexical-based editor
- **AI Integration**: Generate content using AI models from OpenAI, Google Gemini, OpenRouter, or locally hosted models
- **Custom Prompts**: Create and manage custom prompts to guide AI generation
- **Scene Beats Addon to Editor**: Press alt (option for mac) + s in editor to open Scene Beat AI command
- **Lorebook**: Maintain a database of characters, locations, items, events, and notes for your story
- **Local-First**: All your data is stored locally in a SQLite database
- **Data Migration**: Import data from previous IndexedDB-based versions or export your current database

## Technology Stack

- **Backend**: Express.js, SQLite, Drizzle ORM, better-sqlite3
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Shadcn UI
- **State Management**: TanStack Query v5
- **Routing**: React Router v7
- **Database**: SQLite with Drizzle ORM
- **Text Editor**: Lexical v0.24.0
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
![App Screenshot](screenshots/Prompts.jpg)
![App Screenshot](screenshots/Lorebook.jpg)
![App Screenshot](screenshots/CreateChapter.jpg)
![App Screenshot](screenshots/Editor.jpg)
![App Screenshot](screenshots/SceneBeat.jpg)
![App Screenshot](screenshots/GeneratedProse.jpg)

## Project Structure

### Backend

- `server/` - Express.js API server
    - `db/` - Database schema, client, migrations, and seeding
    - `routes/` - API route handlers (stories, chapters, prompts, lorebook, etc.)
    - `index.ts` - Server entry point

### Frontend

- `src/features/` - Feature modules (stories, chapters, prompts, ai, lorebook, brainstorm, notes)
    - `*/hooks/` - TanStack Query hooks for data fetching
    - `*/pages/` - Route components
    - `*/components/` - Feature-specific UI components
- `src/components/` - Reusable UI components
- `src/Lexical/` - Text editor implementation (custom Lexical editor)
- `src/services/` - Services (AI, database, export utilities, API client)
- `src/types/` - TypeScript type definitions
- `src/lib/` - Utility functions and helpers

## Data Management

### Database Export/Import

Export and import your entire database from the AI Settings page:

**Export**: Downloads a JSON file containing all your data (stories, chapters, prompts, lorebook entries, etc.)

**Import**: Replaces all current data with data from a JSON file. System prompts are preserved.

Migration workflow:

1. Export from old IndexedDB-based version (if migrating)
2. Import into new SQLite-based version
3. System prompts automatically initialized on first run

### Prompts Export/Import

Export and import individual prompts from the Prompts Manager UI:

**Export**: Downloads non-system prompts only (system prompts excluded)

**Import**: Validates and creates imported prompts as non-system (editable). Duplicate names get `(Imported)` suffix. New IDs and timestamps generated.

Format:

```json
{
    "version": "1.0",
    "type": "prompts",
    "prompts": [
        /* array of prompt objects */
    ]
}
```

# Roadmap/TODO

- [ ] Replace the component-based guide with markdown-driven documentation presented by a small set of components.
