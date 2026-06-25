# Architecture

LocalFlow is a single-user, local-first desktop music player. A Python backend handles search, downloads, and file serving; a React PWA provides the UI.

## System overview

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (React PWA)                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Search  │  │ Download │  │ Library  │  │  Player   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬─────┘ │
│       │             │             │               │       │
│       └─────────────┴─────────────┴───────────────┘       │
│                         │ fetch /api, /audio                │
└─────────────────────────┼───────────────────────────────────┘
                          │ HTTP (dev: Vite proxy → :3000)
┌─────────────────────────┼───────────────────────────────────┐
│  FastAPI Backend        │                                   │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │  routes/api_routes.py                                 │  │
│  └──────────┬───────────────────────┬────────────────────┘  │
│             │                       │                        │
│  ┌──────────▼──────────┐  ┌─────────▼─────────┐             │
│  │  DownloadManager    │  │  ytdlp_service    │             │
│  │  (download queue)   │  │  (search, dl)     │             │
│  └──────────┬──────────┘  └─────────┬─────────┘             │
│             │                       │                        │
│  ┌──────────▼───────────────────────▼─────────┐             │
│  │  db.py — SQLite (tracks table)            │             │
│  └──────────┬─────────────────────────────────┘             │
│             │                                                │
│  ┌──────────▼─────────────────────────────────┐             │
│  │  Filesystem: ~/.localflow/                 │             │
│  │    audio/  thumbnails/  temp/  localflow.db│             │
│  └────────────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

## Core flow

### 1. Search

`GET /api/search?q=...&limit=...` calls `ytdlp_service.search_yt()` and returns lightweight result objects (`videoUrl`, `title`, `artist`, `duration`, `thumbnailUrl`).

No database writes occur during search.

### 2. Download

`POST /api/download` with `{ "videoUrl": "..." }`:

1. Validates the YouTube URL
2. `DownloadManager` creates a `tracks` row with `status: pending`
3. Job enters a bounded concurrency queue (`DOWNLOAD_QUEUE_CONCURRENCY`)
4. yt-dlp fetches metadata and downloads audio to `~/.localflow/audio/`
5. Thumbnail saved to `~/.localflow/thumbnails/`
6. Row updated to `status: ready` (or `error` with `error_message`)

Returns `202 Accepted` immediately; client polls `GET /api/download/:id`.

### 3. Library

`GET /api/library/tracks` reads from SQLite, ordered by `created_at DESC`. Each track payload includes public URLs:

- `audioUrl` → `/audio/{filename}`
- `thumbnailUrl` → `/thumbnails/{filename}`

### 4. Playback

The frontend player loads `audioUrl` into a hidden `<audio>` element with custom minimal controls (play/pause, seek bar). Files are served by FastAPI `StaticFiles` mounted at `/audio` and `/thumbnails`.

The PWA service worker caches audio with Range-request support for seek/scrub offline.

## Backend layers

| Layer | Responsibility | Key files |
|-------|----------------|-----------|
| HTTP | Routing, validation, response shaping | `routes/api_routes.py`, `main.py` |
| Orchestration | Queue, status transitions | `download_manager.py` |
| External | yt-dlp search and download | `ytdlp_service.py` |
| Persistence | SQLite CRUD for tracks | `db.py` |
| Config | Paths, ports, concurrency | `config.py` |

There is no authentication middleware. All endpoints are open on the local network when bound to `0.0.0.0`.

## Data model

### `tracks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID |
| `title` | TEXT | From yt-dlp metadata |
| `artist` | TEXT | Usually uploader/channel |
| `duration` | INTEGER | Seconds |
| `thumbnail_path` | TEXT | Absolute path on disk (not exposed to client) |
| `audio_path` | TEXT | Absolute path on disk (not exposed to client) |
| `source_url` | TEXT | Original YouTube URL |
| `status` | TEXT | `pending` \| `downloading` \| `ready` \| `error` |
| `progress` | INTEGER | 0–100 |
| `error_message` | TEXT | Set when `status = error` |
| `created_at` | REAL | Unix timestamp |
| `updated_at` | REAL | Unix timestamp |

### `playlists`

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT PK | UUID for user playlists |
| `name` | TEXT | Display name (1–80 chars) |
| `kind` | TEXT | `user` only (system playlists resolved in code) |
| `system_key` | TEXT | Reserved for future use |
| `created_at` | REAL | Unix timestamp |
| `updated_at` | REAL | Unix timestamp |

### `playlist_tracks`

| Column | Type | Notes |
|--------|------|-------|
| `playlist_id` | TEXT FK | → `playlists.id` |
| `track_id` | TEXT FK | → `tracks.id` |
| `position` | INTEGER | 0-based order |
| `added_at` | REAL | Unix timestamp |

PK is `(playlist_id, track_id)` — no duplicates within a playlist.

### `play_history`

| Column | Type | Notes |
|--------|------|-------|
| `track_id` | TEXT PK | → `tracks.id` |
| `played_at` | REAL | Unix timestamp, updated on each replay |

At most 50 entries. Replaying a track updates `played_at` and moves it to the top.

No users table. One library per machine.

## Frontend architecture

| Area | Location | Role |
|------|----------|------|
| API client | `src/api/client.ts` | Typed fetch wrappers, download polling |
| Components | `src/components/` | Search, library, player, settings |
| Settings | `src/settings/localflowSettings.ts` | Theme preference in `localStorage` |
| PWA | `public/service-worker.js` | App shell + media caching |

In development, Vite proxies `/api`, `/audio`, and `/thumbnails` to `http://localhost:3000` so the browser only talks to port 5173.

## Storage layout

```
~/.localflow/
├── audio/           # Final audio files (served statically)
├── thumbnails/      # Cover images
├── temp/            # Scratch space during downloads
└── localflow.db     # SQLite WAL-mode database
```

Override the root with `LOCALFLOW_STORAGE_DIR`.

## Design decisions

| Decision | Rationale |
|----------|-----------|
| No auth | Single-user desktop app; data stays on disk |
| No FFmpeg | Simpler setup; yt-dlp downloads native audio |
| Python backend | yt-dlp is a Python library; tight integration |
| SQLite | Zero-config, local-first, one table is enough for Phase 1 |
| PWA not Electron | Lightweight; works in browser with offline caching |
| Polling over WebSockets | Simpler; adequate for desktop download progress |

## Non-goals

- Multi-user or networked deployment
- React Native / native mobile apps
- Remote streaming or CDN delivery
- Video playback
- FFmpeg transcoding

## Related docs

- [Domain language](04_domain.md)
- [Conventions](03_conventions.md)
- [Roadmap](05_roadmap.md)
