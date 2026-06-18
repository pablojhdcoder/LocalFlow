import re
import threading
from typing import Any, Dict, List, Optional

from yt_dlp import YoutubeDL

from .config import settings


class DownloadCancelled(Exception):
    pass


class _NullLogger:
    def debug(self, _msg: str) -> None:
        return

    def info(self, _msg: str) -> None:
        return

    def warning(self, _msg: str) -> None:
        return

    def error(self, _msg: str) -> None:
        return


def _extract_thumbnail_url(info: Dict[str, Any]) -> str:
    thumb = info.get("thumbnail")
    if isinstance(thumb, str) and thumb.strip():
        return thumb

    thumb = info.get("thumbnail_url")
    if isinstance(thumb, str) and thumb.strip():
        return thumb

    thumbs = info.get("thumbnails")
    if isinstance(thumbs, list) and thumbs:
        first = thumbs[0]
        if isinstance(first, dict) and isinstance(first.get("url"), str):
            return first["url"]

    video_id = info.get("id")
    if isinstance(video_id, str) and video_id.strip():
        return f"https://i.ytimg.com/vi/{video_id.strip()}/hqdefault.jpg"

    return ""


def _video_url_from_entry(entry: Dict[str, Any]) -> str:
    for key in ("webpage_url", "url", "original_url"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            text = value.strip()
            if text.startswith("http"):
                return text
            if text.startswith("watch?"):
                return f"https://www.youtube.com/{text}"

    video_id = entry.get("id")
    if isinstance(video_id, str) and video_id.strip():
        return f"https://www.youtube.com/watch?v={video_id.strip()}"

    return ""


def _safe_int(value: Any, default: int = 0) -> int:
    if isinstance(value, bool):
        return default
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        if value != value:  # NaN
            return default
        return int(value)
    if isinstance(value, str):
        try:
            return int(float(value.strip()))
        except Exception:
            return default
    return default


def _cancel_hook(cancel_event: threading.Event):
    def hook(_d: Dict[str, Any]) -> None:
        if cancel_event.is_set():
            raise DownloadCancelled("Download cancelled")

    return hook


def get_video_info(video_url: str, cancel_event: Optional[threading.Event] = None) -> Dict[str, Any]:
    opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "logger": _NullLogger(),
        "noplaylist": True,
        "skip_download": True,
    }
    if cancel_event is not None:
        opts["progress_hooks"] = [_cancel_hook(cancel_event)]

    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(video_url, download=False)
    title = info.get("title") or "Unknown"
    duration = _safe_int(info.get("duration"), 0)
    thumbnail = _extract_thumbnail_url(info)
    uploader = info.get("uploader") or info.get("channel") or "Unknown Artist"
    return {"title": str(title), "duration": duration, "thumbnail": thumbnail, "uploader": str(uploader)}


def search_yt(query: str, limit: int) -> List[Dict[str, Any]]:
    q = re.sub(r"\s+", " ", query.strip()).replace("\n", " ")
    expr = f"ytsearch{limit}:{q}"

    # extract_flat avoids fetching every result page and is much faster.
    opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "logger": _NullLogger(),
        "noplaylist": True,
        "skip_download": True,
        "extract_flat": "in_playlist",
    }

    with YoutubeDL(opts) as ydl:
        info = ydl.extract_info(expr, download=False)

    entries = info.get("entries") or []
    results: List[Dict[str, Any]] = []

    for entry in entries:
        if not isinstance(entry, dict):
            continue

        video_url = _video_url_from_entry(entry)
        if not video_url:
            continue

        title = entry.get("title") or "Unknown"
        artist = (
            entry.get("uploader")
            or entry.get("channel")
            or entry.get("artist")
            or "Unknown Artist"
        )
        duration = _safe_int(entry.get("duration"), 0)
        thumbnail = _extract_thumbnail_url(entry)

        item: Dict[str, Any] = {
            "videoUrl": str(video_url),
            "title": str(title),
            "artist": str(artist),
            "duration": duration,
        }
        if thumbnail:
            item["thumbnailUrl"] = thumbnail
        results.append(item)

    return results


def download_audio_to_temp(
    video_url: str,
    track_id: str,
    output_template: str,
    cancel_event: threading.Event,
) -> None:
    opts: Dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "logger": _NullLogger(),
        "noplaylist": True,
        "format": settings.ytdlp_audio_format,
        "outtmpl": output_template,
        "progress_hooks": [_cancel_hook(cancel_event)],
    }

    with YoutubeDL(opts) as ydl:
        ydl.download([video_url])
