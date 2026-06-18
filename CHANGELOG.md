# Changelog

All notable changes to LocalFlow are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [1.0.0] - 2026-06-18

First public release.

### Added

#### Backend (Python / FastAPI)

- `GET /api/search` — YouTube search via yt-dlp
- `POST /api/download` — start audio download (returns `202 Accepted`)
- `GET /api/download/:id` — poll download status and progress
- `GET /api/library/tracks` — list library with pagination
- `DELETE /api/library/tracks/:id` — delete track and files on disk
- Static file serving at `/audio/` and `/thumbnails/`
- SQLite `tracks` table (single-user, no auth)
- Download queue with configurable concurrency (`DOWNLOAD_QUEUE_CONCURRENCY`)
- Setup scripts: `setup-backend.ps1`, `setup-backend.sh`
- `.env.example` configuration template

#### Frontend (React / TypeScript / Vite PWA)

- **Library** as default home screen (playlist-style track rows)
- **Search** by keywords with clear button
- **Paste YouTube URL** download flow
- Download progress badges on search results
- Custom minimal audio player (play/pause, seek, no buffer bar)
- Fixed bottom now-playing bar (persists across tabs)
- Dark / light theme toggle (stored in `localStorage`)
- Offline PWA caching (app shell, thumbnails, audio with Range support)

#### Documentation

- README, QUICKSTART, CONTRIBUTING, architecture docs
- Release notes (`RELEASE_NOTES_v1.0.0.md`)
- Issue and PR templates under `.github/`

### Design decisions

- Single-user, local-first — no accounts or cloud sync
- No FFmpeg — audio kept in yt-dlp native format
- English-only UI
- PWA instead of Electron for a lightweight desktop experience

### Known limitations

- No automated test suite
- No playlists or metadata editing
- No user authentication (intentional for local personal use)

---

[Unreleased]: https://github.com/pablojhdcoder/LocalFlow/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/pablojhdcoder/LocalFlow/releases/tag/v1.0.0
