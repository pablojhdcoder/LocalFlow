# Roadmap

LocalFlow targets a reliable **desktop-first**, **offline-capable** music player. Mobile native apps and cloud features are out of scope for now.

## Phase 1 — Core desktop player (dev preview) ✅

**Status: Done (v0.1.0)** — functional prototype, not a stable production release

- [x] YouTube search (`GET /api/search`)
- [x] Paste YouTube URL download
- [x] Download audio with yt-dlp (`POST /api/download`)
- [x] Download queue with configurable concurrency
- [x] Poll download progress (`GET /api/download/:id`)
- [x] Persist audio and thumbnails to `~/.localflow/`
- [x] SQLite `tracks` table (single-user, no auth)
- [x] Library listing and deletion
- [x] Static file serving (`/audio`, `/thumbnails`)
- [x] React PWA frontend (library, search, player)
- [x] Library as default home screen
- [x] Minimal playlist-style UI
- [x] Custom audio player (no native controls / buffer bar)
- [x] Fixed bottom now-playing bar
- [x] Search clear button
- [x] Download progress in UI
- [x] Offline PWA caching (app shell + audio Range requests)
- [x] Python FastAPI backend
- [x] Settings UI (dark / light theme)

## Phase 2 — UX and reliability

**Status: Planned**

- [ ] Automated backend tests (unit + API integration)
- [ ] Frontend component tests
- [ ] Better download error messages and retry UX
- [ ] Keyboard shortcuts and accessibility improvements
- [ ] Search autocomplete / debounce
- [ ] Screenshots and demo GIF in README

## Phase 3 — Library features

**Status: In progress**

- [x] Playlists (local, no sync) — system (All Songs, Recently Played) + user playlists with CRUD, add/remove/reorder tracks
- [ ] Metadata editing (title, artist)
- [ ] Sort and filter library (artist, date, duration)
- [ ] Bulk delete

## Phase 4 — Advanced (optional)

**Status: Future consideration**

- [ ] Audio format / quality selection in UI (`YTDLP_AUDIO_FORMAT`)
- [ ] Desktop wrapper (e.g. Tauri/Electron) for system tray and auto-start
- [ ] Import existing local audio files
- [ ] Export / backup library

## Explicitly out of scope

| Item | Reason |
|------|--------|
| User authentication | Single-user local desktop app |
| React Native / mobile native | Desktop PWA focus |
| Cloud sync | Local-first principle |
| FFmpeg transcoding | Simpler stack; native yt-dlp formats |
| Video playback | Audio-only product |
| Social features | Not aligned with vision |
| Multi-tenant / VPS deployment | Personal machine use case |
| Multi-language UI | English-only for v1 |

## How to propose changes

Open an issue or PR describing:

1. Which phase the feature belongs to
2. User-facing behavior
3. API or schema impact (if any)
4. Manual test plan

See [Contributing](../CONTRIBUTING.md) for development setup.

## Related docs

- [Product vision](01_vision.md)
- [Architecture](02_architecture.md)
- [Domain language](04_domain.md)
