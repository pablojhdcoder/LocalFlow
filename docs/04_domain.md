# Domain Language

Shared vocabulary for LocalFlow. The app is **single-user**, **local-only**, and has **no authentication**.

## Track

A song entry in the local library: metadata plus references to audio and thumbnail files on disk.

A track is identified by a UUID (`id`) and progresses through download states until it is `ready` for playback or ends in `error`.

### Track fields (API)

| Field | Meaning |
|-------|---------|
| `id` | Unique identifier (UUID) |
| `title` | Song title from YouTube metadata |
| `artist` | Channel or uploader name |
| `duration` | Length in seconds |
| `status` | Download lifecycle state (see below) |
| `progress` | Download progress 0–100 |
| `message` | Error description when `status = error` |
| `sourceUrl` | Original YouTube URL |
| `audioUrl` | Public HTTP path to play audio (`/audio/{filename}`) |
| `thumbnailUrl` | Public HTTP path to cover art (`/thumbnails/{filename}`) |
| `createdAt` | When the track was added (ms since epoch) |
| `updatedAt` | Last status or metadata change (ms since epoch) |

Filesystem paths (`audio_path`, `thumbnail_path`) exist in the database but are **not** sent to clients.

## Library

The complete collection of tracks on this machine, stored in `~/.localflow/localflow.db` and served from `~/.localflow/audio/`.

There is one library per installation — no per-user partitioning.

## Download

The process of fetching audio and metadata from a YouTube URL and persisting them locally:

1. Client sends `POST /api/download` with `videoUrl`
2. Backend creates a track row (`pending` → `downloading`)
3. yt-dlp downloads audio to `audio/` and thumbnail to `thumbnails/`
4. Row becomes `ready` or `error`

The client polls `GET /api/download/:id` until the terminal state.

### Download operations

| Action | Endpoint |
|--------|----------|
| Start | `POST /api/download` |
| Poll status | `GET /api/download/:id` |

## Search

A read-only YouTube query via yt-dlp. Returns candidate videos with `videoUrl`, `title`, `artist`, `duration`, and optional `thumbnailUrl`.

Search does not create tracks. The user selects a result to start a download.

## Player

The in-browser audio player that streams a ready track's `audioUrl`. Custom minimal controls: play/pause, seek, and a fixed bottom now-playing bar. Works across Library and Search tabs.

Offline playback is handled by the PWA service worker caching audio files.

## Metadata

Structured information about a track, derived from yt-dlp during download:

- Title
- Artist (uploader)
- Duration
- Thumbnail image

No separate metadata-editing flow exists yet (see roadmap).

## Status

Track download lifecycle states:

| Status | Meaning |
|--------|---------|
| `pending` | Queued, not yet started |
| `downloading` | yt-dlp is fetching audio or thumbnail |
| `ready` | Audio on disk; playable via `audioUrl` |
| `error` | Download failed; see `message` |

The client reads all tracks from `GET /api/library/tracks` and filters by `status` in the UI when needed.

## Storage

Root directory (default `~/.localflow/`):

| Path | Contents |
|------|----------|
| `audio/` | Downloaded audio files |
| `thumbnails/` | Cover images |
| `temp/` | Temporary files during active downloads |
| `localflow.db` | SQLite database (`tracks` table) |

## Explicit non-concepts

These were removed in the legacy refactor and should not appear in new code or docs:

- **User / account** — no registration, login, or JWT
- **library_item** — tracks are not scoped to a user
- **On-demand audio** — audio is always persisted server-side, not streamed once from temp
- **Client confirm** — no `POST .../confirm` step; `ready` means file exists on disk
- **FFmpeg / MP3 conversion** — audio kept in native yt-dlp format

## Related docs

- [Architecture](02_architecture.md)
- [Roadmap](05_roadmap.md)
