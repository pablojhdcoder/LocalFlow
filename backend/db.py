import sqlite3
import threading
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from .config import settings


TRACK_STATUSES = {"pending", "downloading", "ready", "error"}

SYSTEM_PLAYLIST_ALL_SONGS = "system:all_songs"
SYSTEM_PLAYLIST_RECENTLY_PLAYED = "system:recently_played"
PLAY_HISTORY_MAX = 50


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


@dataclass
class Playlist:
    id: str
    name: str
    kind: str  # "system" | "user"
    system_key: Optional[str]  # "all_songs" | "recently_played" for system playlists
    created_at: Optional[float]
    updated_at: Optional[float]
    track_count: int = 0


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
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS playlists (
                  id TEXT PRIMARY KEY,
                  name TEXT NOT NULL,
                  kind TEXT NOT NULL DEFAULT 'user',
                  system_key TEXT,
                  created_at REAL NOT NULL,
                  updated_at REAL NOT NULL
                )
                """
            )
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS playlist_tracks (
                  playlist_id TEXT NOT NULL,
                  track_id TEXT NOT NULL REFERENCES tracks(id),
                  position INTEGER NOT NULL,
                  added_at REAL NOT NULL,
                  PRIMARY KEY (playlist_id, track_id)
                )
                """
            )
            self._db.execute(
                "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id, position)"
            )
            self._db.execute(
                """
                CREATE TABLE IF NOT EXISTS play_history (
                  track_id TEXT NOT NULL PRIMARY KEY REFERENCES tracks(id),
                  played_at REAL NOT NULL
                )
                """
            )
            self._db.execute(
                "CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at)"
            )
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
            self._db.execute("DELETE FROM playlist_tracks WHERE track_id = ?", (track_id,))
            self._db.execute("DELETE FROM play_history WHERE track_id = ?", (track_id,))
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

    # --- Playlist methods ---

    def list_user_playlists(self) -> List["Playlist"]:
        with self._lock:
            rows = self._db.execute(
                "SELECT * FROM playlists WHERE kind='user' ORDER BY created_at ASC"
            ).fetchall()
        return [_row_to_playlist(r) for r in rows]

    def find_playlist(self, playlist_id: str) -> Optional["Playlist"]:
        with self._lock:
            row = self._db.execute(
                "SELECT * FROM playlists WHERE id = ?", (playlist_id,)
            ).fetchone()
        return _row_to_playlist(row) if row else None

    def create_playlist(self, name: str) -> "Playlist":
        playlist_id = str(uuid.uuid4())
        now = time.time()
        with self._lock:
            self._db.execute(
                "INSERT INTO playlists (id, name, kind, system_key, created_at, updated_at) VALUES (?, ?, 'user', NULL, ?, ?)",
                (playlist_id, name, now, now),
            )
            self._db.commit()
        return self.find_playlist(playlist_id)  # type: ignore[return-value]

    def rename_playlist(self, playlist_id: str, name: str) -> Optional["Playlist"]:
        now = time.time()
        with self._lock:
            self._db.execute(
                "UPDATE playlists SET name = ?, updated_at = ? WHERE id = ? AND kind = 'user'",
                (name, now, playlist_id),
            )
            self._db.commit()
        return self.find_playlist(playlist_id)

    def delete_playlist(self, playlist_id: str) -> None:
        with self._lock:
            self._db.execute("DELETE FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,))
            self._db.execute("DELETE FROM playlists WHERE id = ? AND kind = 'user'", (playlist_id,))
            self._db.commit()

    def count_playlist_tracks(self, playlist_id: str) -> int:
        with self._lock:
            row = self._db.execute(
                "SELECT COUNT(*) as c FROM playlist_tracks WHERE playlist_id = ?", (playlist_id,)
            ).fetchone()
        return int(row["c"]) if row else 0

    def add_track_to_playlist(self, playlist_id: str, track_id: str) -> None:
        now = time.time()
        with self._lock:
            existing = self._db.execute(
                "SELECT 1 FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
                (playlist_id, track_id),
            ).fetchone()
            if existing:
                raise ValueError("duplicate")
            max_pos_row = self._db.execute(
                "SELECT COALESCE(MAX(position), -1) as mp FROM playlist_tracks WHERE playlist_id = ?",
                (playlist_id,),
            ).fetchone()
            next_pos = int(max_pos_row["mp"]) + 1
            self._db.execute(
                "INSERT INTO playlist_tracks (playlist_id, track_id, position, added_at) VALUES (?, ?, ?, ?)",
                (playlist_id, track_id, next_pos, now),
            )
            self._db.commit()

    def remove_track_from_playlist(self, playlist_id: str, track_id: str) -> None:
        with self._lock:
            self._db.execute(
                "DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?",
                (playlist_id, track_id),
            )
            self._db.commit()

    def reorder_playlist_tracks(self, playlist_id: str, track_ids: List[str]) -> None:
        now = time.time()
        with self._lock:
            for pos, tid in enumerate(track_ids):
                self._db.execute(
                    "UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?",
                    (pos, playlist_id, tid),
                )
            self._db.execute(
                "UPDATE playlists SET updated_at = ? WHERE id = ?", (now, playlist_id)
            )
            self._db.commit()

    def get_user_playlist_tracks(self, playlist_id: str) -> List["Track"]:
        with self._lock:
            rows = self._db.execute(
                """
                SELECT t.* FROM tracks t
                JOIN playlist_tracks pt ON t.id = pt.track_id
                WHERE pt.playlist_id = ?
                ORDER BY pt.position ASC
                """,
                (playlist_id,),
            ).fetchall()
        return [_row_to_track(r) for r in rows]

    # --- Play history methods ---

    def record_play(self, track_id: str) -> None:
        now = time.time()
        with self._lock:
            self._db.execute(
                "INSERT INTO play_history (track_id, played_at) VALUES (?, ?) ON CONFLICT(track_id) DO UPDATE SET played_at = excluded.played_at",
                (track_id, now),
            )
            # Prune to PLAY_HISTORY_MAX oldest entries
            self._db.execute(
                """
                DELETE FROM play_history WHERE track_id NOT IN (
                  SELECT track_id FROM play_history ORDER BY played_at DESC LIMIT ?
                )
                """,
                (PLAY_HISTORY_MAX,),
            )
            self._db.commit()

    def get_recently_played_tracks(self) -> List["Track"]:
        with self._lock:
            rows = self._db.execute(
                """
                SELECT t.* FROM tracks t
                JOIN play_history ph ON t.id = ph.track_id
                WHERE t.status = 'ready'
                ORDER BY ph.played_at DESC
                LIMIT ?
                """,
                (PLAY_HISTORY_MAX,),
            ).fetchall()
        return [_row_to_track(r) for r in rows]

    def count_recently_played(self) -> int:
        with self._lock:
            row = self._db.execute(
                "SELECT COUNT(*) as c FROM play_history ph JOIN tracks t ON t.id = ph.track_id WHERE t.status = 'ready'"
            ).fetchone()
        return int(row["c"]) if row else 0

    def count_all_songs(self) -> int:
        with self._lock:
            row = self._db.execute(
                "SELECT COUNT(*) as c FROM tracks WHERE status = 'ready'"
            ).fetchone()
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


def _row_to_playlist(row: sqlite3.Row) -> Playlist:
    return Playlist(
        id=row["id"],
        name=row["name"],
        kind=row["kind"],
        system_key=row["system_key"],
        created_at=float(row["created_at"]),
        updated_at=float(row["updated_at"]),
    )


def create_database() -> Database:
    return Database(str(settings.db_path))
