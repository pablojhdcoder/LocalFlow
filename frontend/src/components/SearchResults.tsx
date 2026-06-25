import type { SearchResult, Track, TrackStatus, DownloadMeta } from '../api/client';
import type { Playlist } from '../playlists/playlistTypes';
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
  // Map from sourceUrl → Track for already-downloaded tracks
  libraryTracksBySourceUrl?: Map<string, Track>;
  onPlayTrack?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  userPlaylists?: Playlist[];
  onAddToPlaylist?: (playlistId: string, track: Track) => void;
  onCreateAndAdd?: (track: Track) => void;
};

export default function SearchResults({
  results,
  pendingDownloads,
  isLoading,
  onDownload,
  libraryTracksBySourceUrl,
  onPlayTrack,
  onAddToQueue,
  userPlaylists,
  onAddToPlaylist,
  onCreateAndAdd,
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
          libraryTrack={libraryTracksBySourceUrl?.get(r.videoUrl)}
          onPlayTrack={onPlayTrack}
          onAddToQueue={onAddToQueue}
          userPlaylists={userPlaylists}
          onAddToPlaylist={onAddToPlaylist}
          onCreateAndAdd={onCreateAndAdd}
        />
      ))}
    </div>
  );
}
