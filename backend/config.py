import os
from dataclasses import dataclass
from pathlib import Path


def _default_storage_dir() -> Path:
    base = os.environ.get("LOCALFLOW_STORAGE_DIR")
    if base:
        return Path(base)

    home = os.environ.get("HOME")
    if home:
        return Path(home) / ".localflow"

    return Path(os.environ.get("USERPROFILE", ".")) / ".localflow"


@dataclass(frozen=True)
class Settings:
    host: str = os.environ.get("HOST", "0.0.0.0")
    port: int = int(os.environ.get("PORT", "3000"))

    storage_base_dir: Path = _default_storage_dir()
    audio_dir: Path = storage_base_dir / "audio"
    thumbnail_dir: Path = storage_base_dir / "thumbnails"
    temp_dir: Path = storage_base_dir / "temp"
    db_path: Path = storage_base_dir / "localflow.db"

    download_queue_concurrency: int = int(os.environ.get("DOWNLOAD_QUEUE_CONCURRENCY", "1"))
    ytdlp_audio_format: str = os.environ.get("YTDLP_AUDIO_FORMAT", "bestaudio")


settings = Settings()
