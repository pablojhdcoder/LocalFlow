import type { SearchResult, TrackStatus, DownloadMeta } from '../api/client';
import TrackCard from './TrackCard';

type PendingDownload = {
  videoUrl: string;
  trackId: string;
  status: TrackStatus;
  title: string;
  artist: string;
  thumbnailUrl?: string;
};

type SearchResultsProps = {
  results: SearchResult[];
  pendingDownloads: Record<string, PendingDownload>;
  isLoading?: boolean;
  onDownload: (videoUrl: string, meta?: DownloadMeta) => void;
};

export default function SearchResults({
  results,
  pendingDownloads,
  isLoading,
  onDownload,
}: SearchResultsProps) {
  const visible = results.slice(0, 10);

  if (isLoading) {
    return <div className="loadingState">Searching...</div>;
  }

  if (visible.length === 0) {
    return (
      <div className="emptyState">
        No results yet.
        <br />
        Type at least 3 characters and press Search.
      </div>
    );
  }

  return (
    <div className="trackList">
      <div className="trackListHeader">
        <span />
        <span>Title</span>
        <span className="trackListHeaderDuration">Duration</span>
        <span className="trackListHeaderActions" />
      </div>
      {visible.map(r => (
        <TrackCard
          key={r.videoUrl}
          result={r}
          pending={pendingDownloads[r.videoUrl]}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
