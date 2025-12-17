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

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

Application will be available at: http://localhost:3000

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

To backup:

```bash
cp data/storynexus.db data/storynexus.db.backup
```

## Migration from Tauri App

1. Open the old Tauri app
2. Navigate to AI Settings
3. Click "Export Database" under Database Migration
4. Save the JSON file
5. Open the new web app at http://localhost:3000
6. Navigate to AI Settings
7. Click "Import Database" under Database Migration
8. Upload the JSON file
9. Confirm the import (WARNING: replaces all data)
10. Reload the page

## Environment Variables

- `PORT` - Server port (default: 3000 in prod, 3001 in dev)
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

- Check browser console for errors
- Verify JSON file format
- Ensure backend is running
- Check server logs: `docker-compose logs -f`
