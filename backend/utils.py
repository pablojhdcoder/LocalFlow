import os
import re
import uuid
from pathlib import Path
from typing import Optional, Tuple
from urllib.parse import urlparse, parse_qs

import requests


def generate_track_id() -> str:
    return str(uuid.uuid4())


def is_valid_youtube_url(url: str) -> bool:
    try:
        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower()
        pathname = parsed.path or ""

        # youtu.be/<id>
        if hostname == "youtu.be":
            return len(pathname.strip("/")) > 0

        # Accept *.youtube.com including www and m.
        if not (hostname.endswith("youtube.com") or hostname == "youtube.com"):
            return False

        # /watch?v=<id>
        if pathname == "/watch":
            qs = parse_qs(parsed.query)
            v = (qs.get("v") or [""])[0]
            return bool(v and v.strip())

        # /shorts/<id>, /embed/<id>, /live/<id>
        segments = [s for s in pathname.split("/") if s]
        if len(segments) >= 2:
            kind = segments[0]
            vid = segments[1]
            if kind in {"shorts", "embed", "live"}:
                return bool(vid.strip())

        return False
    except Exception:
        return False


def parse_youtube_title(title: str) -> Tuple[str, str]:
    # Common formats:
    # - "Artist - Title"
    # - "Title by Artist"
    clean_title = (
        title.replace("\n", " ").strip()
    )

    clean_title = re.sub(r"\(official\s+(video|audio|music\s+video)\)", "", clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r"\[official\s+(video|audio|music\s+video)\]", "", clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r"\(lyrics?\)", "", clean_title, flags=re.IGNORECASE)
    clean_title = re.sub(r"\[lyrics?\]", "", clean_title, flags=re.IGNORECASE)
    clean_title = clean_title.strip()

    if " - " in clean_title:
        parts = clean_title.split(" - ")
        if len(parts) >= 2:
            artist = parts[0].strip()
            name = " - ".join(parts[1:]).strip()
            if artist and name:
                return name, artist

    if re.search(r"\s+by\s+", clean_title, flags=re.IGNORECASE):
        parts = re.split(r"\s+by\s+", clean_title, flags=re.IGNORECASE)
        if len(parts) == 2:
            name = parts[0].strip()
            artist = parts[1].strip()
            if artist and name:
                return name, artist

    return clean_title, "Unknown Artist"


def delete_if_exists(p: Optional[str]) -> None:
    if not p:
        return
    try:
        os.remove(p)
    except FileNotFoundError:
        return
    except Exception:
        # best-effort cleanup
        return


def download_bytes(url: str, dest_path: str, timeout_seconds: int = 30) -> None:
    resp = requests.get(url, timeout=timeout_seconds)
    resp.raise_for_status()
    Path(dest_path).parent.mkdir(parents=True, exist_ok=True)
    with open(dest_path, "wb") as f:
        f.write(resp.content)

