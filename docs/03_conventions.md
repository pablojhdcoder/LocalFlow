# Coding Conventions

Conventions for the LocalFlow codebase: Python backend and TypeScript/React frontend.

## General principles

- Prefer simplicity and explicitness over clever abstractions
- Keep functions small and focused
- Handle errors explicitly; never fail silently
- Match existing patterns in the file you are editing
- UI text and user-facing docs in English
- No new dependencies without clear justification

## Backend (Python)

### Language and style

- Python 3.10+
- Use type hints on function signatures and dataclasses
- `snake_case` for functions, variables, and module names
- `PascalCase` for classes (`Track`, `Database`, `DownloadManager`)
- `UPPER_CASE` for module-level constants (`TRACK_STATUSES`)

### File organization

```
backend/
├── main.py              # App factory, mounts, startup/shutdown
├── config.py            # Settings dataclass from env vars
├── db.py                # SQLite access
├── download_manager.py  # Download queue logic
├── ytdlp_service.py     # yt-dlp integration
├── routes/api_routes.py # HTTP handlers only
└── utils.py             # Shared helpers
```

- One main responsibility per module
- Route handlers stay thin — delegate to manager/service layers
- Keep modules under ~300 lines when practical

### API responses

- Return JSON with camelCase field names for client compatibility (`sourceUrl`, `audioUrl`, `createdAt`)
- Never expose absolute filesystem paths; return `audioUrl` / `thumbnailUrl` or filenames only
- Use `HTTPException` with `{"error": "...", "message": "..."}` detail shape
- Validate inputs at the route boundary (type, required fields, allowed enums)

### Error handling

- Catch domain errors (`ValueError`) at routes and map to 400/404
- Let unexpected exceptions propagate (FastAPI returns 500)
- Store user-visible download errors in `tracks.error_message`

### Database

- All DB access through `db.py` (`Database` class)
- Use the existing `Track` dataclass; do not return raw `sqlite3.Row` to callers
- Thread-safe access via the module's lock

### Configuration

- Read env vars in `config.py` only
- Use `settings` singleton; do not read `os.environ` scattered across modules

## Frontend (TypeScript + React)

### Language and style

- TypeScript strict mode; avoid `any`
- `camelCase` for variables and functions
- `PascalCase` for React components and types
- `UPPER_CASE` for constants (`LOCALFLOW_SETTINGS_KEY`)

### File organization

```
frontend/src/
├── api/client.ts       # All HTTP calls
├── components/         # One component per file
├── settings/           # localStorage preferences
├── App.tsx
└── main.tsx
```

### React patterns

- Functional components with hooks
- Keep components focused; extract helpers when logic grows
- API calls go through `src/api/client.ts`, not inline `fetch` in components

### API client

- No authentication headers
- Use `ApiClientError` for failed responses
- Normalize track URLs via `audioUrlFromTrack()` / `thumbnailUrlFromTrack()`

### Settings

- Persist UI preferences in `localStorage` under `localflow_settings_v1`
- Wrap `localStorage` access in try/catch (private browsing, quota errors)
- Settings are client-only (theme) — not synced to backend

### PWA

- Service worker changes must preserve Range-aware audio caching
- Do not break app-shell offline behavior
- See `.cursor/rules/pwa-offline-safety.mdc`

## Comments

- Explain **why**, not what the code already says
- Document non-obvious business rules (e.g. duplicate URL handling, cancel semantics)
- Skip comments on self-explanatory one-liners

## Documentation updates

When changing API contracts:

1. Update `README.md` endpoint section
2. Add or update curl examples in `.cursor/commands/SOFT_SMOKE_TEST.md`
3. Update `docs/04_domain.md` if domain terms change

## Git commits

Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `chore:`

## Related docs

- [Architecture](02_architecture.md)
- [Domain language](04_domain.md)
- [Contributing](../CONTRIBUTING.md)
