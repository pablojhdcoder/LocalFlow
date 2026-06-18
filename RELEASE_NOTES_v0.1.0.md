# LocalFlow v0.1.0 — First development release

> **Development preview** — not production-ready. Expect breaking changes, missing features, and rough edges.

LocalFlow is a local-first desktop music player. Search YouTube, download audio to your machine, and play it offline through a React PWA.

## Highlights

- **No accounts** — single-user, runs entirely on your computer
- **YouTube search** — find music via `yt-dlp`
- **Local library** — audio and thumbnails stored under `~/.localflow/`
- **Offline playback** — PWA caches app shell and audio files
- **Minimal UI** — playlist-style library, fixed now-playing bar, dark/light theme

## Requirements

- Python 3.10+
- Node.js 18+
- FFmpeg **not** required

## Quick start

```bash
git clone https://github.com/pablojhdcoder/LocalFlow.git
cd LocalFlow

# Backend
.\setup-backend.ps1          # Windows
# bash setup-backend.sh      # macOS / Linux

# Frontend (second terminal)
cd frontend && npm install && npm run dev
```

- API: http://localhost:3000
- UI: http://localhost:5173

See [QUICKSTART.md](QUICKSTART.md) and [README.md](README.md) for full instructions.

## What's included

### Backend (Python / FastAPI)

- `GET /api/search` — YouTube search
- `POST /api/download` — start download
- `GET /api/download/:id` — poll status
- `GET /api/library/tracks` — list library
- `DELETE /api/library/tracks/:id` — remove track
- Static serving at `/audio/` and `/thumbnails/`

### Frontend (React / TypeScript / Vite PWA)

- Library view (default home screen)
- Search by keywords or paste a YouTube URL
- Download progress indicators
- Custom minimal audio player
- Theme toggle (dark / light)

## Known limitations

- **Early development** — APIs and UI may change without notice
- No user authentication (by design)
- No playlists yet
- No automated test suite yet
- Desktop PWA focus — not a native mobile app

## Documentation

- [Architecture](docs/02_architecture.md)
- [Roadmap](docs/05_roadmap.md)
- [Contributing](CONTRIBUTING.md)

## License

MIT
