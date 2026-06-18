# Quick Start

Get LocalFlow running locally in a few minutes.

## Prerequisites

- **Python 3.10+** (`python` on Windows, `python3` on Linux/macOS/WSL)
- **Node.js 18+** and npm (for the frontend UI)

FFmpeg is **not** required. Audio is downloaded in its native format via `yt-dlp`.

## 1. Start the backend

From the repository root:

**Windows (PowerShell):**

```powershell
.\setup-backend.ps1
```

**macOS / Linux / WSL:**

```bash
bash setup-backend.sh
```

This script:

- Creates `backend/.venv` if missing
- Installs Python dependencies from `backend/requirements.txt`
- Starts the FastAPI server on `http://localhost:3000`

To install dependencies without starting the server:

```powershell
.\setup-backend.ps1 -SetupOnly
```

```bash
SETUP_ONLY=1 bash setup-backend.sh
```

## 2. Start the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The Vite dev server proxies API and media requests to the backend on port 3000.

## 3. Verify the backend

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok","timestamp":"..."}`

## 4. Use the UI

1. The app opens on **Library** (empty at first)
2. Go to **Search**, type at least 3 characters, press **Search**
3. Click **Add** on a result — download starts
4. When complete, the track appears in **Library**
5. Click a row to play — the bottom bar shows now playing

You can also paste a YouTube URL under **Or paste a link**.

## 5. Try the API (optional)

**Search:**

```bash
curl "http://localhost:3000/api/search?q=acdc&limit=3"
```

**Start a download:**

```bash
curl -X POST http://localhost:3000/api/download \
  -H "Content-Type: application/json" \
  -d '{"videoUrl":"https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

Copy the `track.id` from the response, then poll:

```bash
curl http://localhost:3000/api/download/<trackId>
```

Repeat until `status` is `ready` or `error`.

**List your library:**

```bash
curl "http://localhost:3000/api/library/tracks?limit=10"
```

**Play audio** — use the `audioUrl` from a ready track, e.g.:

```
http://localhost:3000/audio/<filename>
```

## 6. Optional configuration

```bash
cp .env.example .env
```

Edit `.env` to change port, storage directory, or download concurrency. Restart the backend after changes.

For frontend-only overrides (e.g. custom API URL in production builds), see `frontend/.env.example`.

## Where data is stored

By default:

- **Windows:** `%USERPROFILE%\.localflow\`
- **macOS / Linux:** `~/.localflow/`

Contains `audio/`, `thumbnails/`, `temp/`, and `localflow.db`.

## Troubleshooting

| Problem | Check |
|---------|-------|
| `python` not found | Install Python 3.10+ and ensure it is on your PATH |
| Port 3000 in use | Set `PORT=3001` in `.env` and restart |
| Download stays on `error` | Run `curl http://localhost:3000/api/download/<id>` and read `message` |
| Frontend cannot reach API | Ensure backend is running; Vite proxies to `localhost:3000` |
| Bottom player overlaps content | Scroll — padding is applied automatically when playing |

## Next steps

- Full docs: [README.md](README.md)
- Architecture: [docs/02_architecture.md](docs/02_architecture.md)
- Manual smoke test: [.cursor/commands/SOFT_SMOKE_TEST.md](.cursor/commands/SOFT_SMOKE_TEST.md)
