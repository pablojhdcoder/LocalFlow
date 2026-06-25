import os
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse

from ..db import (
    Track,
    Playlist,
    SYSTEM_PLAYLIST_ALL_SONGS,
    SYSTEM_PLAYLIST_RECENTLY_PLAYED,
)
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
    # delete_track cascades: removes from playlist_tracks and play_history automatically
    db.delete_track(track_id)

    return {"message": "Track deleted"}


# --- Playlist helpers ---

def _to_playlist_payload(pl: Playlist) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "id": pl.id,
        "name": pl.name,
        "kind": pl.kind,
        "trackCount": pl.track_count,
    }
    if pl.system_key:
        payload["systemKey"] = pl.system_key
    if pl.created_at is not None:
        payload["createdAt"] = int(pl.created_at * 1000)
    if pl.updated_at is not None:
        payload["updatedAt"] = int(pl.updated_at * 1000)
    return payload


def _build_system_playlists(db: Any) -> List[Dict[str, Any]]:
    all_songs = Playlist(
        id=SYSTEM_PLAYLIST_ALL_SONGS,
        name="All Songs",
        kind="system",
        system_key="all_songs",
        created_at=None,
        updated_at=None,
        track_count=db.count_all_songs(),
    )
    recently_played = Playlist(
        id=SYSTEM_PLAYLIST_RECENTLY_PLAYED,
        name="Recently Played",
        kind="system",
        system_key="recently_played",
        created_at=None,
        updated_at=None,
        track_count=db.count_recently_played(),
    )
    return [_to_playlist_payload(all_songs), _to_playlist_payload(recently_played)]


# --- Playlist endpoints ---

@router.get("/playlists")
async def list_playlists(request: Request):
    db = request.app.state.db
    system_payloads = _build_system_playlists(db)
    user_playlists = db.list_user_playlists()
    user_payloads = []
    for pl in user_playlists:
        pl.track_count = db.count_playlist_tracks(pl.id)
        user_payloads.append(_to_playlist_payload(pl))
    return {"playlists": system_payloads + user_payloads}


@router.post("/playlists")
async def create_playlist(request: Request):
    body = await request.json()
    name = body.get("name", "")
    if not isinstance(name, str):
        raise HTTPException(status_code=400, detail={"error": "Bad Request", "message": "name must be a string"})
    name = name.strip()
    if not name or len(name) > 80:
        raise HTTPException(status_code=400, detail={"error": "Bad Request", "message": "name must be 1–80 characters"})

    db = request.app.state.db
    pl = db.create_playlist(name)
    pl.track_count = 0
    return {"playlist": _to_playlist_payload(pl)}


@router.patch("/playlists/{playlist_id}")
async def rename_playlist(request: Request, playlist_id: str):
    if playlist_id.startswith("system:"):
        raise HTTPException(status_code=403, detail={"error": "Forbidden", "message": "System playlists cannot be renamed"})

    body = await request.json()
    name = body.get("name", "")
    if not isinstance(name, str):
        raise HTTPException(status_code=400, detail={"error": "Bad Request", "message": "name must be a string"})
    name = name.strip()
    if not name or len(name) > 80:
        raise HTTPException(status_code=400, detail={"error": "Bad Request", "message": "name must be 1–80 characters"})

    db = request.app.state.db
    pl = db.rename_playlist(playlist_id, name)
    if not pl:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Playlist not found"})
    pl.track_count = db.count_playlist_tracks(pl.id)
    return {"playlist": _to_playlist_payload(pl)}


@router.delete("/playlists/{playlist_id}")
async def delete_playlist(request: Request, playlist_id: str):
    if playlist_id.startswith("system:"):
        raise HTTPException(status_code=403, detail={"error": "Forbidden", "message": "System playlists cannot be deleted"})

    db = request.app.state.db
    pl = db.find_playlist(playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Playlist not found"})

    db.delete_playlist(playlist_id)
    return {"message": "Playlist deleted"}


@router.get("/playlists/{playlist_id}/tracks")
async def get_playlist_tracks(request: Request, playlist_id: str):
    db = request.app.state.db

    if playlist_id == SYSTEM_PLAYLIST_ALL_SONGS:
        tracks = db.find_all(limit=None, offset=None)
        ready = [t for t in tracks if t.status == "ready"]
        return {"tracks": [_to_track_payload(t) for t in ready]}

    if playlist_id == SYSTEM_PLAYLIST_RECENTLY_PLAYED:
        tracks = db.get_recently_played_tracks()
        return {"tracks": [_to_track_payload(t) for t in tracks]}

    pl = db.find_playlist(playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Playlist not found"})
    tracks = db.get_user_playlist_tracks(playlist_id)
    return {"tracks": [_to_track_payload(t) for t in tracks]}


@router.post("/playlists/{playlist_id}/tracks")
async def add_track_to_playlist(request: Request, playlist_id: str):
    if playlist_id.startswith("system:"):
        raise HTTPException(status_code=403, detail={"error": "Forbidden", "message": "Cannot add tracks to system playlists"})

    body = await request.json()
    track_id = body.get("trackId")
    if not isinstance(track_id, str) or not track_id.strip():
        raise HTTPException(status_code=400, detail={"error": "Bad Request", "message": "trackId is required"})

    db = request.app.state.db
    pl = db.find_playlist(playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Playlist not found"})

    track = db.find_by_id(track_id)
    if not track:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Track not found"})

    try:
        db.add_track_to_playlist(playlist_id, track_id)
    except ValueError:
        # Track already in playlist — reject with 409 (no silent duplicates)
        raise HTTPException(status_code=409, detail={"error": "Conflict", "message": "Track is already in this playlist"})

    return {"message": "Track added"}


@router.delete("/playlists/{playlist_id}/tracks/{track_id}")
async def remove_track_from_playlist(request: Request, playlist_id: str, track_id: str):
    if playlist_id.startswith("system:"):
        raise HTTPException(status_code=403, detail={"error": "Forbidden", "message": "Cannot remove tracks from system playlists"})

    db = request.app.state.db
    pl = db.find_playlist(playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Playlist not found"})

    db.remove_track_from_playlist(playlist_id, track_id)
    return {"message": "Track removed"}


@router.put("/playlists/{playlist_id}/tracks/reorder")
async def reorder_playlist_tracks(request: Request, playlist_id: str):
    if playlist_id.startswith("system:"):
        raise HTTPException(status_code=403, detail={"error": "Forbidden", "message": "Cannot reorder system playlists"})

    body = await request.json()
    track_ids = body.get("trackIds")
    if not isinstance(track_ids, list) or not all(isinstance(tid, str) for tid in track_ids):
        raise HTTPException(status_code=400, detail={"error": "Bad Request", "message": "trackIds must be an array of strings"})

    db = request.app.state.db
    pl = db.find_playlist(playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Playlist not found"})

    db.reorder_playlist_tracks(playlist_id, track_ids)
    return {"message": "Tracks reordered"}


# --- Play history endpoint ---

@router.post("/play-history")
async def record_play_history(request: Request):
    body = await request.json()
    track_id = body.get("trackId")
    if not isinstance(track_id, str) or not track_id.strip():
        raise HTTPException(status_code=400, detail={"error": "Bad Request", "message": "trackId is required"})

    db = request.app.state.db
    track = db.find_by_id(track_id)
    if not track:
        raise HTTPException(status_code=404, detail={"error": "Not Found", "message": "Track not found"})

    db.record_play(track_id)
    return {"message": "Recorded"}
