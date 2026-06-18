# LocalFlow

> **Tired of subscriptions and ads killing your flow?** Build your own music library on your computer — search YouTube, download tracks to your drive, and listen offline. No monthly fees. No interruptions. Your music, your machine.

LocalFlow is a local-first desktop music player — no accounts, no cloud, no streaming server.

## What it does

1. **Search** — find music on YouTube by keywords or paste a URL
2. **Download** — persist audio and thumbnails under `~/.localflow/`
3. **Library** — browse your collection from a local SQLite database
4. **Play** — stream files from `/audio/{filename}` with a minimal bottom player

## What it is not

- Not a streaming service
- Not a mobile native app (no React Native)
- Not multi-user (no authentication)
- Not dependent on FFmpeg (audio is saved in its native format via `yt-dlp`)

## Tech stack

| Layer | Stack |
|-------|-------|
| Backend | Python 3.10+, FastAPI, yt-dlp, SQLite |
| Frontend | React, TypeScript, Vite PWA |
| Storage | Local filesystem + SQLite (`tracks` table) |

## Prerequisites

- **Python 3.10+** (backend; `python` on Windows, `python3` on Linux/macOS)
- **Node.js 18+** and npm (frontend)

FFmpeg is **not** required.

## Quick start

```bash
# 1. Clone
git clone https://github.com/pablojhdcoder/LocalFlow.git
cd LocalFlow

# 2. Backend (creates venv, installs deps, starts server)
# Windows (PowerShell):
.\setup-backend.ps1

# macOS / Linux / WSL:
bash setup-backend.sh

# 3. Frontend (separate terminal)
cd frontend && npm install && npm run dev
```

- Backend API: `http://localhost:3000`
- Frontend UI: `http://localhost:5173` (proxies `/api`, `/audio`, `/thumbnails` to the backend)

Optional: copy `.env.example` to `.env` and adjust settings.

## User flow

```
Library (home)  ←  download completes
       ↑
Search  →  POST /api/download  →  poll GET /api/download/:id
                                        ↓
                              GET /api/library/tracks  →  play /audio/:file
```

1. Open the app — **Library** is the default screen
2. Go to **Search**, type a query or paste a YouTube URL
3. Click **Add** — frontend calls `POST /api/download`
4. Poll `GET /api/download/:id` until `status` is `ready` or `error`
5. Track appears in **Library** — click a row to play
6. Playback shows in the fixed bottom bar (works across tabs)

## API reference

All endpoints are public — no auth headers required.

### Health

```bash
curl http://localhost:3000/health
```

### Search

```bash
curl "http://localhost:3000/api/search?q=acdc&limit=5"
```

Response:

```json
{
  "results": [
    {
      "videoUrl": "https://www.youtube.com/watch?v=...",
      "title": "...",
      "artist": "...",
      "duration": 240,
      "thumbnailUrl": "..."
    }
  ]
}
```

### Download

**Start download** — returns `202 Accepted`:

```bash
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{"videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

**Poll status**:

```bash
curl http://localhost:3000/api/download/{trackId}
```

Track `status` values: `pending`, `downloading`, `ready`, `error`.

### Library

**List tracks** (supports `limit` and `offset`):

```bash
curl "http://localhost:3000/api/library/tracks?limit=10&offset=0"
```

**Delete track** (removes DB row and files on disk):

```bash
curl -X DELETE http://localhost:3000/api/library/tracks/{trackId}
```

Each track in responses includes `audioUrl` and `thumbnailUrl` when available.

### Static files

| Path | Content |
|------|---------|
| `GET /audio/{filename}` | Downloaded audio file |
| `GET /thumbnails/{filename}` | Track thumbnail image |

## Project structure

```
.
├── backend/                  # FastAPI + yt-dlp + SQLite
│   ├── main.py               # App entry, static mounts, startup
│   ├── config.py             # Environment-based settings
│   ├── db.py                 # SQLite tracks table
│   ├── download_manager.py   # Download queue and orchestration
│   ├── ytdlp_service.py      # Search, metadata, audio download
│   ├── routes/api_routes.py  # REST endpoints
│   └── requirements.txt
├── frontend/                 # React + TypeScript + Vite PWA
│   ├── src/
│   │   ├── api/client.ts     # API client
│   │   ├── components/       # Library, Search, Player, Settings, …
│   │   └── settings/         # Theme preference (localStorage)
│   └── public/
│       └── service-worker.js # Offline caching
├── docs/                     # Architecture, conventions, domain, roadmap
├── setup-backend.ps1         # Windows backend setup + run
└── setup-backend.sh          # Unix backend setup + run
```

## Configuration

Set variables in a `.env` file at the repo root (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `HOST` | `0.0.0.0` | Backend bind address |
| `PORT` | `3000` | Backend port |
| `LOCALFLOW_STORAGE_DIR` | `~/.localflow` | Root data directory |
| `DOWNLOAD_QUEUE_CONCURRENCY` | `1` | Max parallel downloads |
| `YTDLP_AUDIO_FORMAT` | `bestaudio` | yt-dlp audio format selector |

Frontend optional build-time variable (see `frontend/.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | _(empty)_ | API origin when UI is served separately from backend |

## Storage layout

Default location: `~/.localflow/` (or `%USERPROFILE%\.localflow` on Windows)

```
~/.localflow/
├── audio/          # Downloaded audio files
├── thumbnails/     # Track cover images
├── temp/           # Temporary files during download
└── localflow.db    # SQLite database (tracks table)
```

## Development

### Backend only

```powershell
# Windows — setup without starting:
.\setup-backend.ps1 -SetupOnly

# Then run manually:
backend\.venv\Scripts\python -m uvicorn backend.main:app --host 0.0.0.0 --port 3000 --reload
```

```bash
# Unix — setup without starting:
SETUP_ONLY=1 bash setup-backend.sh

# Then run manually:
backend/.venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 3000 --reload
```

### Frontend

```bash
cd frontend
npm run dev        # Dev server with HMR (port 5173)
npm run build      # Production build
npm run preview    # Preview production build
npm run typecheck  # TypeScript check
```

### Smoke test

See [`.cursor/commands/SOFT_SMOKE_TEST.md`](.cursor/commands/SOFT_SMOKE_TEST.md) for manual curl checks.

## Documentation

| Doc | Description |
|-----|-------------|
| [QUICKSTART.md](QUICKSTART.md) | Get running in minutes |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development workflow |
| [CHANGELOG.md](CHANGELOG.md) | Version history |
| [docs/](docs/README.md) | Architecture, conventions, domain, roadmap |

## Security

LocalFlow has **no authentication** and binds to `0.0.0.0` by default. Use it on your own machine or a trusted local network. Do not expose it directly to the public internet.

## License

MIT — see [LICENSE](LICENSE).
