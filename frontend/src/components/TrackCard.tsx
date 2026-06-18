import type { SearchResult, TrackStatus, DownloadMeta } from '../api/client';
import { formatDurationSeconds } from '../utils/format';

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

export default function TrackCard({ result, pending, onDownload }: TrackCardProps) {
  const thumbnailUrl = pending?.thumbnailUrl || result.thumbnailUrl;
  const isBlocked = Boolean(pending && pending.status !== 'error');

  const buttonLabel = pending?.status === 'error' ? 'Retry' : 'Add';
  const durationText = formatDurationSeconds(result.duration);

  return (
    <div className="trackRow">
      <div className="trackRowIndex">
        <span className="trackRowIndexNum" />
      </div>

      <div className="trackRowMain">
        <div className="trackRowThumb" aria-hidden="true">
          {thumbnailUrl ? <img src={thumbnailUrl} alt="" /> : null}
        </div>
        <div className="trackRowInfo">
          <div className="trackRowTitle">{pending?.title || result.title}</div>
          <div className="trackRowArtist">
            {pending?.artist || result.artist}
            {pending ? (
              <span style={{ marginLeft: 8 }}>
                <span className={statusClass(pending.status)}>{pendingStatusLabel(pending)}</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="trackRowDuration">{durationText ?? '—'}</div>

      <div className="trackRowActions">
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
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}
