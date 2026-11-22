# Deployment Guide

## Development

### Prerequisites

- Node.js 20+
- npm

### Running Locally

```bash
# Install dependencies
npm install

# Run development server (concurrent backend + frontend)
npm run dev
```

Development servers:

- Backend API: http://localhost:3001
- Frontend: http://localhost:5173 (proxies /api to backend)

### Building

```bash
# Build both frontend and backend
npm run build
```

Built files:

- Frontend: `dist/client/`
- Backend: `dist/server/`

## Production (Docker)

### Using Docker Compose

`docker-compose.yml` pulls the published image (`jonsilver/storynexus:latest`); it does not build from your checkout.

```bash
# Pull and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Application will be available at: http://localhost:3000

To build from source instead: `docker-compose -f docker-compose.dev.yml up --build`.

Compose reads these from the environment or a `.env` file (see `.env.production.example`): `APP_PORT` (default 3000; sets the container's `PORT` too), `DATA_PATH` (host data directory, default `./data`), `PUID`/`PGID` (user the container runs as, default 1000), `DOCKER_IMAGE` and `IMAGE_TAG`.

### Using Docker Directly

```bash
# Build image
docker build -t storynexus .

# Run container
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --name storynexus \
  storynexus
```

### Data Persistence

SQLite database is stored in `./data/storynexus.db` (mounted as volume).

To backup, use the in-app backup (Settings → Backup → Download backup, or `GET /api/admin/backup`) — it produces a single consistent snapshot via SQLite's online backup API.

**Do NOT** copy `storynexus.db` alone while the app is running: the database runs in WAL mode, so recent writing can live entirely in `storynexus.db-wal` and a bare file copy silently omits it. If you must copy files, stop the app first and copy `storynexus.db`, `storynexus.db-wal` and `storynexus.db-shm` together.

Images are stored separately under `data/assets/` — include that directory in any backup.

## Migration from Tauri App

The web app has no button for this any more; the server endpoint remains.

1. In the old Tauri app, export the database (AI Settings → Database Migration → Export Database) and save the JSON file.
2. Take a backup of the web app first: the import **deletes all existing data** before loading the file.
3. Upload the file to the import endpoint:

    ```bash
    curl -F "file=@storynexus-export.json" http://localhost:3000/api/admin/import
    ```

    The file must be JSON with `version` and `tables` properties.

4. Reload the app.

## Environment Variables

- `PORT` - Server port (default: 3000; `npm run dev` sets 3001)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_PATH` - SQLite database file path (default: ./data/storynexus.db)

## Accessing from Other Devices

1. Find your server's LAN IP address:

    ```bash
    # Linux/Mac
    hostname -I

    # Windows
    ipconfig
    ```

2. Access from other devices on the same network:
    ```
    http://YOUR-SERVER-IP:3000
    ```

Example: `http://192.168.1.100:3000`

## Local AI Models (LM Studio / OpenAI-compatible)

AI generation runs on the **server**, so the local model URL configured in Settings must be reachable from wherever the Story Nexus server runs — not from your phone or browser.

- **Bare-metal server + LM Studio on the same machine**: the default `http://localhost:1234/v1` works.
- **Docker on Linux, LM Studio on the host**: `localhost` inside the container is the container itself. Add a host gateway and use it:

    ```yaml
    # docker-compose.yml
    services:
        storynexus:
            extra_hosts:
                - "host.docker.internal:host-gateway"
    ```

    Then set the local API URL to `http://host.docker.internal:1234/v1`.

- **Docker Desktop (Mac/Windows)**: `http://host.docker.internal:1234/v1` works out of the box.
- **Model server on another LAN machine**: use that machine's LAN IP, e.g. `http://192.168.1.50:1234/v1`, and make sure the model server listens on the network, not just loopback.

Saving the URL in Settings tests the connection and fetches the model list; a failure there means the server can't reach the model host.

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Database Locked

SQLite can lock if multiple processes access it. Ensure only one instance is running.

### Migration Failed

- Read the endpoint's JSON error response
- Verify the file has `version` and `tables` properties
- Ensure the server is running
- Check server logs (`[Import]` lines): `docker-compose logs -f`
