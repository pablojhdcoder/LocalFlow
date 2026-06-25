import type { Track, TrackStatus } from '../api/client';
import { audioUrlFromTrack, thumbnailUrlFromTrack } from '../api/client';
import { formatAddedDate, formatDurationSeconds } from '../utils/format';

type LibraryProps = {
  tracks: Track[];
  loading: boolean;
  error: string | null;
  onDeleteTrack: (trackId: string) => Promise<void>;
  onPlayTrack: (track: Track) => void;
  nowPlayingId: string | null;
  onAddToQueue: (track: Track) => void;
  queueTrackIds: Set<string>;
};

function statusClass(status: TrackStatus): string {
  if (status === 'ready') return 'status statusReady';
  if (status === 'error') return 'status statusError';
  return 'status';
}

function statusLabel(track: Track): string {
  if (track.status === 'downloading' || track.status === 'pending') {
    const pct = track.progress ?? 0;
    return `${track.status} (${pct}%)`;
  }
  return track.status;
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}

function QueueAddIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M3 12h14M3 18h10M19 15v6M16 18h6" />
    </svg>
  );
}

export default function Library({
  tracks,
  loading,
  error,
  onDeleteTrack,
  onPlayTrack,
  nowPlayingId,
  onAddToQueue,
  queueTrackIds,
}: LibraryProps) {
  async function handleDelete(trackId: string): Promise<void> {
    const ok = window.confirm('Delete this track from your library?');
    if (!ok) return;
    await onDeleteTrack(trackId);
  }

  return (
    <div className="page">
      <h1 className="pageTitle">Your Library</h1>

      {loading && tracks.length === 0 ? (
        <div className="loadingState">Loading library...</div>
      ) : null}

      {error ? <div className="errorBox">{error}</div> : null}

      {tracks.length > 0 ? (
        <div className="trackList">
          <div className="trackListHeader">
            <span>#</span>
            <span>Title</span>
            <span className="trackListHeaderDuration">Duration</span>
            <span className="trackListHeaderActions" />
          </div>

          {tracks.map((t, index) => {
            const thumbnailUrl = thumbnailUrlFromTrack(t);
            const audioUrl = audioUrlFromTrack(t);
            const isPlaying = nowPlayingId === t.id;
            const canPlay = t.status === 'ready' && Boolean(audioUrl);
            const inQueue = queueTrackIds.has(t.id);

            return (
              <div
                key={t.id}
                className={`trackRow${canPlay ? ' trackRowPlayable' : ''}${isPlaying ? ' trackRowActive' : ''}`}
                onClick={() => {
                  if (canPlay) onPlayTrack(t);
                }}
                onKeyDown={e => {
                  if (canPlay && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onPlayTrack(t);
                  }
                }}
                role={canPlay ? 'button' : undefined}
                tabIndex={canPlay ? 0 : undefined}
              >
                <div className="trackRowIndex">
                  <span className="trackRowIndexNum">{index + 1}</span>
                  {canPlay ? (
                    <button
                      type="button"
                      className="trackRowPlayBtn"
                      aria-label={isPlaying ? 'Playing' : 'Play'}
                      onClick={e => {
                        e.stopPropagation();
                        onPlayTrack(t);
                      }}
                    >
                      <PlayIcon />
                    </button>
                  ) : null}
                </div>

                <div className="trackRowMain">
                  <div className="trackRowThumb" aria-hidden="true">
                    {thumbnailUrl ? <img src={thumbnailUrl} alt="" /> : null}
                  </div>
                  <div className="trackRowInfo">
                    <div className="trackRowTitle">{t.title}</div>
                    <div className="trackRowArtist">
                      {t.artist}
                      {t.status !== 'ready' ? (
                        <span style={{ marginLeft: 8 }}>
                          <span className={statusClass(t.status)}>{statusLabel(t)}</span>
                        </span>
                      ) : t.createdAt ? (
                        <span className="trackRowDate"> · Added {formatAddedDate(t.createdAt)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="trackRowDuration">
                  {t.duration ? formatDurationSeconds(t.duration) : '—'}
                </div>

                <div className="trackRowActions">
                  {canPlay ? (
                    <button
                      type="button"
                      className={`iconButton${inQueue ? ' iconButtonActive' : ''}`}
                      aria-label={inQueue ? 'Already in queue' : 'Add to queue'}
                      title={inQueue ? 'Already in queue' : 'Add to queue'}
                      onClick={e => {
                        e.stopPropagation();
                        onAddToQueue(t);
                      }}
                    >
                      <QueueAddIcon />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="iconButton iconButtonDanger"
                    aria-label="Delete track"
                    onClick={e => {
                      e.stopPropagation();
                      void handleDelete(t.id);
                    }}
                  >
                    <DeleteIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {tracks.length === 0 && !loading ? (
        <div className="emptyState">
          Your library is empty.
          <br />
          Go to Search to find music and add tracks.
        </div>
      ) : null}
    </div>
  );
}
