import asyncio
import glob
import os
import threading
from typing import Dict, Optional

from .config import settings
from .db import Database, Track
from .utils import delete_if_exists, download_bytes, generate_track_id, parse_youtube_title
from .ytdlp_service import DownloadCancelled, download_audio_to_temp, get_video_info


class DownloadManager:
    def __init__(self, *, db: Database):
        self._db = db
        self._semaphore = asyncio.Semaphore(settings.download_queue_concurrency)
        self._active_tasks: Dict[str, asyncio.Task] = {}
        self._cancel_events: Dict[str, threading.Event] = {}

    def _start_job(self, *, track_id: str, video_url: str) -> None:
        if track_id in self._active_tasks:
            return

        cancel_event = threading.Event()
        self._cancel_events[track_id] = cancel_event

        task = asyncio.create_task(self._run_job(track_id=track_id, video_url=video_url, cancel_event=cancel_event))
        self._active_tasks[track_id] = task

        def _cleanup(_t: asyncio.Task) -> None:
            self._active_tasks.pop(track_id, None)
            self._cancel_events.pop(track_id, None)

        task.add_done_callback(_cleanup)

    async def download_track(self, video_url: str) -> Track:
        existing = self._db.find_by_source_url(video_url)
        if existing:
            if existing.status == "ready":
                return existing
            if existing.status == "error":
                self._db.update_track(
                    existing.id,
                    {
                        "title": "Downloading...",
                        "artist": "Unknown",
                        "duration": 0,
                        "audio_path": "",
                        "thumbnail_path": None,
                        "status": "pending",
                        "progress": 0,
                        "error_message": None,
                    },
                )
                self._start_job(track_id=existing.id, video_url=existing.source_url)
            else:
                # pending/downloading: return current state
                pass
            return self._db.find_by_id(existing.id) or existing

        track_id = generate_track_id()
        self._db.create_track(
            id=track_id,
            title="Downloading...",
            artist="Unknown",
            duration=0,
            thumbnail_path=None,
            audio_path="",
            source_url=video_url,
            status="pending",
            progress=0,
            error_message=None,
        )
        self._start_job(track_id=track_id, video_url=video_url)
        return self._db.find_by_id(track_id)  # type: ignore[return-value]

    def _cleanup_partial_files(self, track_id: str) -> None:
        # temp artifacts
        patterns = [
            os.path.join(str(settings.temp_dir), f"{track_id}.*"),
        ]
        for pattern in patterns:
            for f in glob.glob(pattern):
                delete_if_exists(f)

        track = self._db.find_by_id(track_id)
        if not track:
            return
        delete_if_exists(track.audio_path)
        delete_if_exists(track.thumbnail_path)

    async def _run_job(self, *, track_id: str, video_url: str, cancel_event: threading.Event) -> None:
        async with self._semaphore:
            try:
                self._db.update_track(track_id, {"status": "downloading", "progress": 5, "error_message": None})

                # Step 1: info
                info = await asyncio.to_thread(get_video_info, video_url, cancel_event)
                title, artist = parse_youtube_title(info.get("title") or "Unknown")
                duration = int(info.get("duration") or 0)
                thumbnail_url = info.get("thumbnail") or ""

                if cancel_event.is_set():
                    raise DownloadCancelled()
                self._db.update_track(track_id, {"title": title, "artist": artist, "progress": 15})

                # Step 2: download + extract audio into temp
                output_template = os.path.join(str(settings.temp_dir), f"{track_id}.%(ext)s")
                await asyncio.to_thread(download_audio_to_temp, video_url, track_id, output_template, cancel_event)
                if cancel_event.is_set():
                    raise DownloadCancelled()

                extracted = self._find_extracted_audio_path(track_id)
                if not extracted:
                    raise RuntimeError("Extracted audio file not found")

                self._db.update_track(track_id, {"progress": 45})

                # Step 3: move downloaded audio to final library path (keep real extension).
                extracted_ext = os.path.splitext(extracted)[1].lstrip(".") or "audio"
                final_audio_path = os.path.join(str(settings.audio_dir), f"{track_id}.{extracted_ext}")
                os.replace(extracted, final_audio_path)
                self._db.update_track(track_id, {"progress": 70})

                # Step 4: duration (best-effort)
                duration_final = duration if duration > 0 else 0

                # Step 5: thumbnail download
                final_thumbnail_path = os.path.join(str(settings.thumbnail_dir), f"{track_id}.jpg")
                if thumbnail_url:
                    await asyncio.to_thread(download_bytes, thumbnail_url, final_thumbnail_path)
                else:
                    # If thumbnail_url missing, keep thumbnail_path null.
                    final_thumbnail_path = ""

                self._db.update_track(
                    track_id,
                    {
                        "title": title,
                        "artist": artist,
                        "duration": int(duration_final),
                        "audio_path": final_audio_path,
                        "thumbnail_path": final_thumbnail_path or None,
                        "status": "ready",
                        "progress": 100,
                        "error_message": None,
                    },
                )

                # Cleanup temp artifacts
                await asyncio.to_thread(self._cleanup_temp_audio, track_id)
            except (DownloadCancelled, asyncio.CancelledError):
                self._db.update_track(track_id, {"status": "error", "progress": 0, "error_message": "Download cancelled"})
                await asyncio.to_thread(self._cleanup_partial_files, track_id)
            except Exception as e:
                self._db.update_track(
                    track_id,
                    {"status": "error", "progress": 0, "error_message": str(e) or "Download failed"},
                )
                # Keep temp artifacts for debugging? Node keeps them; we will best-effort cleanup.
                await asyncio.to_thread(self._cleanup_partial_files, track_id)

    def _find_extracted_audio_path(self, track_id: str) -> Optional[str]:
        patterns = [os.path.join(str(settings.temp_dir), f"{track_id}.*")]
        for pattern in patterns:
            files = glob.glob(pattern)
            if files:
                return files[0]
        return None

    def _cleanup_temp_audio(self, track_id: str) -> None:
        pattern = os.path.join(str(settings.temp_dir), f"{track_id}.*")
        for f in glob.glob(pattern):
            delete_if_exists(f)

