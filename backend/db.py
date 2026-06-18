import sqlite3
import threading
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .config import settings


TRACK_STATUSES = {"pending", "downloading", "ready", "error"}


@dataclass
class Track:
    id: str
    title: str
    artist: str
    duration: int
    thumbnail_path: Optional[str]
    audio_path: str
    source_url: str
    status: str
    progress: int
    error_message: Optional[str]
    created_at: float
    updated_at: float


class Database:
    def __init__(self, db_path: str):
        self._lock = threading.Lock()
        self._db = sqlite3.connect(db_path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row

    def init(self) -> None:
        with self._lock:
            self._db.execute("PRAGMA journal_mode=WAL")
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS tracks (
                  id TEXT PRIMARY KEY,
                  title TEXT NOT NULL,
                  artist TEXT NOT NULL,
                  duration INTEGER NOT NULL,
                  thumbnail_path TEXT,
                  audio_path TEXT NOT NULL,
                  source_url TEXT NOT NULL,
                  status TEXT NOT NULL,
                  progress INTEGER NOT NULL DEFAULT 0,
                  error_message TEXT,
                  created_at REAL NOT NULL,
                  updated_at REAL NOT NULL
                )
                """
            )
            self._db.execute("CREATE INDEX IF NOT EXISTS idx_tracks_status ON tracks(status)")
            self._db.execute("CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at)")
            self._db.commit()

    def close(self) -> None:
        with self._lock:
            self._db.close()

    def create_track(
        self,
        *,
        id: str,
        title: str,
        artist: str,
        duration: int,
        thumbnail_path: Optional[str],
        audio_path: str,
        source_url: str,
        status: str,
        progress: int = 0,
        error_message: Optional[str] = None,
    ) -> Track:
        now = time.time()
        with self._lock:
            self._db.execute(
                """
                INSERT INTO tracks (
                  id, title, artist, duration, thumbnail_path, audio_path,
                  source_url, status, progress, error_message, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    id,
                    title,
                    artist,
                    duration,
                    thumbnail_path,
                    audio_path,
                    source_url,
                    status,
                    progress,
                    error_message,
                    now,
                    now,
                ),
            )
            self._db.commit()
        return self.find_by_id(id)  # type: ignore[return-value]

    def find_by_id(self, track_id: str) -> Optional[Track]:
        with self._lock:
            row = self._db.execute("SELECT * FROM tracks WHERE id = ?", (track_id,)).fetchone()
        return _row_to_track(row) if row else None

    def find_by_source_url(self, source_url: str) -> Optional[Track]:
        with self._lock:
            row = self._db.execute("SELECT * FROM tracks WHERE source_url = ?", (source_url,)).fetchone()
        return _row_to_track(row) if row else None

    def update_track(self, track_id: str, updates: Dict[str, Any]) -> None:
        allowed_keys = {
            "title",
            "artist",
            "duration",
            "thumbnail_path",
            "audio_path",
            "status",
            "progress",
            "error_message",
        }
        sets = []
        values: List[Any] = []

        for k, v in updates.items():
            if k not in allowed_keys:
                continue
            sets.append(f"{k} = ?")
            values.append(v)

        if not sets:
            return

        sets.append("updated_at = ?")
        values.append(time.time())
        values.append(track_id)

        with self._lock:
            self._db.execute(f"UPDATE tracks SET {', '.join(sets)} WHERE id = ?", tuple(values))
            self._db.commit()

    def delete_track(self, track_id: str) -> None:
        with self._lock:
            self._db.execute("DELETE FROM tracks WHERE id = ?", (track_id,))
            self._db.commit()

    def find_all(self, limit: Optional[int], offset: Optional[int]) -> List[Track]:
        sql = "SELECT * FROM tracks ORDER BY created_at DESC"
        params: List[Any] = []
        if limit is not None:
            sql += " LIMIT ?"
            params.append(limit)
            if offset is not None:
                sql += " OFFSET ?"
                params.append(offset)
        with self._lock:
            rows = self._db.execute(sql, tuple(params)).fetchall()
        return [_row_to_track(r) for r in rows if r]

    def count(self) -> int:
        with self._lock:
            row = self._db.execute("SELECT COUNT(*) as c FROM tracks").fetchone()
        return int(row["c"]) if row else 0


def _row_to_track(row: sqlite3.Row) -> Track:
    return Track(
        id=row["id"],
        title=row["title"],
        artist=row["artist"],
        duration=int(row["duration"]),
        thumbnail_path=row["thumbnail_path"],
        audio_path=row["audio_path"],
        source_url=row["source_url"],
        status=row["status"],
        progress=int(row["progress"]),
        error_message=row["error_message"],
        created_at=float(row["created_at"]),
        updated_at=float(row["updated_at"]),
    )


def create_database() -> Database:
    return Database(str(settings.db_path))
