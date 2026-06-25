import type { SearchResult, Track, TrackStatus, DownloadMeta } from '../api/client';
import { thumbnailUrlFromTrack } from '../api/client';
import { formatDurationSeconds } from '../utils/format';
import type { Playlist } from '../playlists/playlistTypes';
import AddToPlaylistMenu from './AddToPlaylistMenu';

type PendingDownload = {
  videoUrl: string;
  trackId: string;
  status: TrackStatus;
  progress?: number;
  title: string;
  artist: string;
  thumbnailUrl?: string;
};

type TrackCardProps = {
  result: SearchResult;
  pending?: PendingDownload;
  onDownload: (videoUrl: string, meta?: DownloadMeta) => void;
  // Present when this search result is already in the library
  libraryTrack?: Track;
  onPlayTrack?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  userPlaylists?: Playlist[];
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  onCreateAndAdd?: (track: Track) => void;
};

function statusClass(status: TrackStatus): string {
  if (status === 'ready') return 'status statusReady';
  if (status === 'error') return 'status statusError';
  return 'status';
}

function pendingStatusLabel(pending: PendingDownload): string {
  if (pending.status === 'downloading' || pending.status === 'pending') {
    return `${pending.status} (${pending.progress ?? 0}%)`;
  }
  return pending.status;
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function QueueAddIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M3 12h14M3 18h10M19 15v6M16 18h6" />
    </svg>
  );
}

export default function TrackCard({
  result,
  pending,
  onDownload,
  libraryTrack,
  onPlayTrack,
  onAddToQueue,
  userPlaylists,
  onAddToPlaylist,
  onCreateAndAdd,
}: TrackCardProps) {
  const thumbnailUrl = pending?.thumbnailUrl || result.thumbnailUrl;
  const isBlocked = Boolean(pending && pending.status !== 'error');
  const durationText = formatDurationSeconds(result.duration);

  // Show "In library" actions when the track is already downloaded and ready
  const isInLibrary = Boolean(libraryTrack);
  const canPlay = libraryTrack?.status === 'ready';

  // Thumbnail from library track takes priority (stored locally)
  const resolvedThumbnail = libraryTrack
    ? (thumbnailUrlFromTrack(libraryTrack) ?? thumbnailUrl)
    : thumbnailUrl;

  return (
    <div className="trackRow">
      <div className="trackRowIndex">
        <span className="trackRowIndexNum" />
      </div>

      <div className="trackRowMain">
        <div className="trackRowThumb" aria-hidden="true">
          {resolvedThumbnail ? <img src={resolvedThumbnail} alt="" /> : null}
        </div>
        <div className="trackRowInfo">
          <div className="trackRowTitle">{pending?.title || result.title}</div>
          <div className="trackRowArtist">
            {pending?.artist || result.artist}
            {isInLibrary ? (
              <span className="inLibraryBadge">In library</span>
            ) : null}
            {pending && !isInLibrary ? (
              <span style={{ marginLeft: 8 }}>
                <span className={statusClass(pending.status)}>{pendingStatusLabel(pending)}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="trackRowDuration">{durationText ?? '—'}</div>

      <div className="trackRowActions">
        {isInLibrary && libraryTrack && canPlay ? (
          <>
            <button
              type="button"
              className="iconButton"
              aria-label={`Play ${result.title}`}
              title="Play"
              onClick={() => onPlayTrack?.(libraryTrack)}
            >
              <PlayIcon />
            </button>
            <button
              type="button"
              className="iconButton"
              aria-label={`Add ${result.title} to queue`}
              title="Add to queue"
              onClick={() => onAddToQueue?.(libraryTrack)}
            >
              <QueueAddIcon />
            </button>
            {onAddToPlaylist && onCreateAndAdd ? (
              <AddToPlaylistMenu
                track={libraryTrack}
                userPlaylists={userPlaylists ?? []}
                onAddToPlaylist={onAddToPlaylist}
                onCreateAndAdd={onCreateAndAdd}
              />
            ) : null}
          </>
        ) : isInLibrary && libraryTrack ? (
          <span className={statusClass(libraryTrack.status)}>{libraryTrack.status}</span>
        ) : (
          <button
            className="button buttonPrimary trackRowActionBtn"
            onClick={() =>
              onDownload(result.videoUrl, {
                title: result.title,
                artist: result.artist,
                thumbnailUrl: result.thumbnailUrl,
              })
            }
            disabled={isBlocked}
            type="button"
            aria-disabled={isBlocked}
            aria-label={
              pending?.status === 'error'
                ? 'Retry download'
                : isBlocked
                ? `Downloading ${pending?.progress ?? 0}%`
                : 'Add to library'
            }
          >
            {pending?.status === 'error' ? 'Retry' : 'Add'}
          </button>
        )}
      </div>
    </div>
  );
}
