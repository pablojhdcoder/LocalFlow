from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.staticfiles import StaticFiles

from .config import settings
from .db import create_database
from .download_manager import DownloadManager
from .routes.api_routes import router as api_router
from pathlib import Path


app = FastAPI(title="LocalFlow Python Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


_ensure_dir(settings.storage_base_dir)
_ensure_dir(settings.audio_dir)
_ensure_dir(settings.thumbnail_dir)
_ensure_dir(settings.temp_dir)

app.mount("/audio", StaticFiles(directory=str(settings.audio_dir), html=False), name="audio")
app.mount(
    "/thumbnails",
    StaticFiles(directory=str(settings.thumbnail_dir), html=False),
    name="thumbnails",
)


@app.on_event("startup")
def on_startup() -> None:
    app.state.db = create_database()
    app.state.db.init()
    app.state.download_manager = DownloadManager(db=app.state.db)


@app.get("/health")
def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})


@app.exception_handler(HTTPException)
async def http_exception_handler(_request: Request, exc: HTTPException):
    detail = exc.detail
    if isinstance(detail, dict):
        return JSONResponse(status_code=exc.status_code, content=detail)

    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "Internal Server Error", "message": str(detail)},
    )
