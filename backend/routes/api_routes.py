import os
from typing import Any, Dict, Optional
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from ..db import Track
from ..download_manager import DownloadManager
from ..utils import delete_if_exists, is_valid_youtube_url
from ..ytdlp_service import search_yt


router = APIRouter()


def _filename_from_path(p: Optional[str]) -> str:
    if not p:
        return ""
    return os.path.basename(p)


def _public_audio_url(filename: str) -> str:
    if not filename:
        return ""
    return f"/audio/{quote(filename)}"


def _public_thumbnail_url(filename: str) -> str:
    if not filename:
        return ""
    return f"/thumbnails/{quote(filename)}"


def _to_track_payload(track: Track) -> Dict[str, Any]:
    audio_filename = _filename_from_path(track.audio_path)
    thumb_filename = _filename_from_path(track.thumbnail_path)

    return {
        "id": track.id,
        "title": track.title,
        "artist": track.artist,
        "duration": track.duration,
        "status": track.status,
        "progress": track.progress,
        "message": track.error_message,
        "sourceUrl": track.source_url,
        "createdAt": int(track.created_at * 1000),
        "updatedAt": int(track.updated_at * 1000),
        "audioPath": audio_filename,
        "audioUrl": _public_audio_url(audio_filename) if audio_filename else "",
        "thumbnailPath": thumb_filename if thumb_filename else None,
        "thumbnailUrl": _public_thumbnail_url(thumb_filename) if thumb_filename else "",
    }


@router.post("/download")
async def post_download(request: Request):
    body = await request.json()
    video_url = body.get("videoUrl")
    if not isinstance(video_url, str) or not video_url.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "Bad Request", "message": "videoUrl is required and must be a string"},
        )
    if not is_valid_youtube_url(video_url):
        raise HTTPException(status_code=400, detail={"error": "Bad Request", "message": "Invalid YouTube URL"})

    manager: DownloadManager = request.app.state.download_manager
    track = await manager.download_track(video_url)

    return JSONResponse(
        status_code=202,
        content={
            "message": "Download started",
            "track": {
                "id": track.id,
                "title": track.title,
                "artist": track.artist,
                "status": track.status,
                "progress": track.progress,
                "sourceUrl": track.source_url,
            },
        },
    )


@router.get("/download/{track_id}")
async def get_download_status(request: Request, track_id: str):
    track = request.app.state.db.find_by_id(track_id)
    if not track:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Track not found"})

    return {"track": _to_track_payload(track)}


@router.get("/search")
async def search(request: Request, q: Optional[str] = None, limit: Optional[int] = 10):
    if not q or not isinstance(q, str) or not q.strip():
        raise HTTPException(
            status_code=400,
            detail={"error": "Bad Request", "message": "Query param `q` is required and must be a non-empty string"},
        )

    parsed_limit = 10
    try:
        parsed_limit = int(limit) if limit is not None else 10
    except Exception:
        parsed_limit = 10

    parsed_limit = max(1, min(20, parsed_limit))

    try:
        results = search_yt(q, parsed_limit)
    except Exception as e:
        raise HTTPException(status_code=500, detail={"error": "Internal Server Error", "message": str(e)})

    return {"results": results}


@router.get("/library/tracks")
async def list_library_tracks(
    request: Request,
    limit: Optional[int] = None,
    offset: Optional[int] = None,
):
    db = request.app.state.db
    tracks = db.find_all(limit=limit, offset=offset)
    total = db.count()

    return {
        "tracks": [_to_track_payload(t) for t in tracks],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.delete("/library/tracks/{track_id}")
async def delete_library_track(request: Request, track_id: str):
    db = request.app.state.db
    track = db.find_by_id(track_id)
    if not track:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Track not found"})

    delete_if_exists(track.audio_path)
    delete_if_exists(track.thumbnail_path)
    db.delete_track(track_id)

    return {"message": "Track deleted"}
