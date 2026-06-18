# Contributing to LocalFlow

Thank you for your interest in contributing. LocalFlow is a local-first desktop app with a Python backend and a React/TypeScript frontend.

## Getting started

1. Fork the repository
2. Clone your fork: `git clone <your-fork-url>`
3. Set up the backend:

   ```powershell
   # Windows
   .\setup-backend.ps1 -SetupOnly
   ```

   ```bash
   # macOS / Linux / WSL
   SETUP_ONLY=1 bash setup-backend.sh
   ```

4. Set up the frontend:

   ```bash
   cd frontend && npm install
   ```

5. Copy optional config: `cp .env.example .env`

6. Start both services in development:

   ```powershell
   # Terminal 1 — backend
   .\setup-backend.ps1
   ```

   ```bash
   # Terminal 2 — frontend
   cd frontend && npm run dev
   ```

7. Verify: `curl http://localhost:3000/health`

## Development workflow

1. Create a branch: `git checkout -b feature/your-feature-name`
2. Make focused changes with minimal surface area
3. Test manually (see below)
4. Update docs if you change API contracts or behavior
5. Commit with a clear message
6. Open a Pull Request against `main`

## Backend (Python)

### Structure

```
backend/
├── main.py              # FastAPI app, static mounts, lifecycle
├── config.py            # Settings from environment variables
├── db.py                # SQLite access (tracks table)
├── download_manager.py  # Queue and download orchestration
├── ytdlp_service.py     # yt-dlp search, metadata, download
├── routes/api_routes.py # HTTP endpoints
└── utils.py             # URL validation, file helpers
```

### Guidelines

- Python 3.10+ with type hints where practical
- Keep functions small and explicit
- Validate inputs at route boundaries
- Never return absolute filesystem paths to clients — use `audioUrl` / `thumbnailUrl`
- Do not add dependencies without justification
- FFmpeg is not used; audio stays in yt-dlp's native format

### Run / test backend

```bash
# From repo root, with venv active:
backend/.venv/bin/python -m uvicorn backend.main:app --host 0.0.0.0 --port 3000 --reload
```

Use `curl` against `http://localhost:3000`. See [`.cursor/commands/SOFT_SMOKE_TEST.md`](.cursor/commands/SOFT_SMOKE_TEST.md).

When adding or changing endpoints, update `README.md` with the route and a curl example.

## Frontend (TypeScript + React)

### Structure

```
frontend/src/
├── api/client.ts       # API client (no auth headers)
├── components/         # UI components
├── settings/           # Theme preference (localStorage)
├── App.tsx             # Main app shell
└── main.tsx            # Entry point
```

### Commands

```bash
cd frontend
npm run dev         # Dev server (port 5173, proxies to backend)
npm run build       # Production build + typecheck
npm run typecheck   # TypeScript only
npm run preview     # Preview production build
```

### Guidelines

- TypeScript everywhere; avoid `any`
- UI text in English
- No new npm dependencies without justification
- Match existing component and naming patterns
- PWA changes must preserve offline audio caching (see `.cursor/rules/pwa-offline-safety.mdc`)

## Commit messages

Use conventional commits:

| Prefix | Use for |
|--------|---------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation |
| `refactor:` | Code change without behavior change |
| `chore:` | Tooling, deps, config |

Examples:

```
feat: add retry button for failed downloads
fix: handle empty search query gracefully
docs: update API endpoint examples
```

## Pull request checklist

- [ ] Changes are scoped and tested manually
- [ ] API changes documented in `README.md`
- [ ] No secrets or `.env` files committed
- [ ] Frontend typecheck passes: `cd frontend && npm run typecheck`
- [ ] Smoke test steps included in PR description when touching API or download flow

## Areas for contribution

### High priority

- Automated tests (backend unit tests, API integration tests)
- Download progress reliability and error messages
- PWA offline playback edge cases

### Medium priority

- Playlists
- Metadata editing
- Audio quality / format selection UI
- Keyboard shortcuts and accessibility

### Out of scope (for now)

- User accounts and authentication
- React Native / mobile native apps
- Cloud sync
- FFmpeg transcoding pipeline

## Questions or bugs

- Search existing issues before opening a new one
- Include OS, Python version, Node version, and steps to reproduce
- Attach relevant `curl` output or backend logs when reporting download failures

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
