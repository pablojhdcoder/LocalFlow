# Frontend (React PWA)

The LocalFlow UI is a React + TypeScript progressive web app built with Vite. It talks to the Python backend for search, downloads, and playback — no login required.

## Responsibilities

- **Library** — default home screen; playlist-style track rows
- **Search** — keyword search with clear button; paste YouTube URL
- **Download** — trigger `POST /api/download`, poll until `ready` or `error`
- **Player** — custom minimal controls via hidden `<audio>` element
- **Now playing** — fixed bottom bar across all tabs
- **Settings** — dark / light theme in `localStorage`
- **Offline** — service worker caches app shell, thumbnails, and audio (Range-aware)

## Architecture

```
src/
├── main.tsx              # React entry
├── App.tsx               # Tab shell (Library / Search), player state
├── api/client.ts         # Typed API client (no auth)
├── components/
│   ├── Library.tsx       # Playlist-style library
│   ├── SearchBar.tsx     # Keyword search + clear
│   ├── SearchResults.tsx
│   ├── TrackCard.tsx     # Search result row
│   ├── PasteYouTubeUrl.tsx
│   ├── Player.tsx        # Custom minimal player
│   ├── NowPlayingBar.tsx # Fixed bottom bar (portal)
│   └── SettingsMenu.tsx  # Theme toggle
├── settings/
│   └── localflowSettings.ts   # theme in localStorage
└── utils/
    └── format.ts         # Duration formatting
```

PWA assets:

- `public/service-worker.js` — caching strategy
- `public/manifest.webmanifest` — install metadata

## Development

Prerequisites: backend running on `http://localhost:3000`.

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies these paths to the backend:

| Path | Target |
|------|--------|
| `/api/*` | `http://localhost:3000` |
| `/audio/*` | `http://localhost:3000` |
| `/thumbnails/*` | `http://localhost:3000` |

### Other commands

```bash
npm run build       # typecheck + production bundle
npm run typecheck   # TypeScript only
npm run preview     # serve production build locally
```

## API integration

All HTTP calls go through `src/api/client.ts`:

| Function | Endpoint |
|----------|----------|
| `searchTracks(q, limit)` | `GET /api/search` |
| `downloadFromVideoUrl(url)` | `POST /api/download` |
| `getDownloadStatus(id)` | `GET /api/download/:id` |
| `pollDownloadUntilDone(id)` | polls until terminal status |
| `getLibraryTracks(limit, offset)` | `GET /api/library/tracks` |
| `deleteLibraryTrack(id)` | `DELETE /api/library/tracks/:id` |

No `Authorization` headers are sent.

### Custom API base URL

Set `VITE_API_BASE_URL` at build time if the frontend is served separately from the backend (e.g. production deployment). Leave unset in local dev to use relative paths through the Vite proxy.

## Settings

Stored under `localflow_settings_v1` in `localStorage`:

| Key | Values | Default |
|-----|--------|---------|
| `theme` | `dark` \| `light` | `dark` |

Settings are client-only. The UI is English-only.

## Offline behavior

The service worker caches:

- App shell (HTML, JS, CSS)
- Thumbnail images
- Audio files (with `Range` request support for seeking)

After visiting tracks while online, playback should work offline for cached audio.

When changing `public/service-worker.js`, follow the rules in `.cursor/rules/pwa-offline-safety.mdc` and test offline manually.

## Manual test checklist

1. Start backend + `npm run dev`
2. App opens on **Library**
3. Search for a song → results appear
4. Click **Add** → download starts, progress badge updates
5. Track appears in Library when `ready`
6. Click a row → audio plays, bottom bar shows
7. Switch to Search tab → player keeps playing
8. Clear search with **×** → results disappear
9. Toggle theme in Settings → persists after reload
10. (Optional) DevTools → Application → Service Workers → go offline → replay cached track

## Related docs

- [Root README](../README.md)
- [Architecture](../docs/02_architecture.md)
- [Smoke test](../.cursor/commands/SOFT_SMOKE_TEST.md)
