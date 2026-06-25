import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Track } from '../api/client';
import { audioUrlFromTrack, thumbnailUrlFromTrack, getPlaylistTracks } from '../api/client';
import { formatAddedDate, formatDurationSeconds } from '../utils/format';
import {
  readLibrarySort,
  writeLibrarySort,
  type LibrarySortKey,
} from '../queue/queueActions';
import type { Playlist } from '../playlists/playlistTypes';
import { PLAYLIST_ALL_SONGS, PLAYLIST_RECENTLY_PLAYED } from '../playlists/playlistTypes';
import AddToPlaylistMenu from './AddToPlaylistMenu';

type PlaylistDetailProps = {
  playlist: Playlist | null;
  libraryTracks: Track[];
  libraryLoading: boolean;
  nowPlayingId: string | null;
  queueTrackIds: Set<string>;
  userPlaylists: Playlist[];
  recentlyPlayedVersion: number;
  playlistTracksVersion: number;
  onPlayTrack: (track: Track) => void;
  onPlayNext: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  onDeleteTrack: (trackId: string) => Promise<void>;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onCreateAndAdd: (track: Track) => void;
  onRemoveFromPlaylist?: (trackId: string) => Promise<void>;
  onReorderTracks?: (trackIds: string[]) => Promise<void>;
};

// --- Icons ---

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

function PlayNextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M3 12h12M3 18h8" />
      <path d="M17 10l5 4-5 4V10z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function RemoveFromPlaylistIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M3 12h12M3 18h8M19 15l5 5m0-5l-5 5" />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" /><circle cx="15" cy="17" r="1.5" />
    </svg>
  );
}

function statusClass(status: Track['status']): string {
  if (status === 'ready') return 'status statusReady';
  if (status === 'error') return 'status statusError';
  return 'status';
}

function statusLabel(track: Track): string {
  if (track.status === 'downloading' || track.status === 'pending') {
    return `${track.status} (${track.progress ?? 0}%)`;
  }
  return track.status;
}

export default function PlaylistDetail({
  playlist,
  libraryTracks,
  libraryLoading,
  nowPlayingId,
  queueTrackIds,
  userPlaylists,
  recentlyPlayedVersion,
  playlistTracksVersion,
  onPlayTrack,
  onPlayNext,
  onAddToQueue,
  onDeleteTrack,
  onAddToPlaylist,
  onCreateAndAdd,
  onRemoveFromPlaylist,
  onReorderTracks,
}: PlaylistDetailProps) {
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [playlistLoading, setPlaylistLoading] = useState(false);

  const isAllSongs = playlist?.id === PLAYLIST_ALL_SONGS;
  const isRecentlyPlayed = playlist?.id === PLAYLIST_RECENTLY_PLAYED;
  const isUserPlaylist = playlist?.kind === 'user';

  // Sort/filter only for All Songs and user playlists
  const [sortKey, setSortKey] = useState<LibrarySortKey>(() => readLibrarySort());
  const [filterText, setFilterText] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');

  // Drag-and-drop state for user playlist reorder
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedFilter(filterText), 200);
    return () => clearTimeout(t);
  }, [filterText]);

  const loadPlaylistTracks = useCallback(async () => {
    if (!playlist || isAllSongs) return;
    setPlaylistLoading(true);
    try {
      const data = await getPlaylistTracks(playlist.id);
      setPlaylistTracks(data.tracks ?? []);
    } finally {
      setPlaylistLoading(false);
    }
  }, [playlist, isAllSongs]);

  useEffect(() => {
    if (isAllSongs) {
      setPlaylistTracks([]);
    } else {
      void loadPlaylistTracks();
    }
    // Reset filter when switching playlist
    setFilterText('');
  }, [playlist?.id, isAllSongs, loadPlaylistTracks]);

  // Re-fetch recently played when a new track is played
  useEffect(() => {
    if (!isRecentlyPlayed) return;
    void loadPlaylistTracks();
  }, [recentlyPlayedVersion, isRecentlyPlayed, loadPlaylistTracks]);

  // Re-fetch user playlist tracks after add/remove/reorder
  useEffect(() => {
    if (!isUserPlaylist) return;
    void loadPlaylistTracks();
  }, [playlistTracksVersion, isUserPlaylist, loadPlaylistTracks]);

  // Derive the base tracks to show
  const baseTracks = useMemo(() => {
    if (isAllSongs) {
      return libraryTracks;
    }
    return playlistTracks;
  }, [isAllSongs, libraryTracks, playlistTracks]);

  const visibleTracks = useMemo(() => {
    // Recently Played: no sort/filter UI, just show as-is
    if (isRecentlyPlayed) return baseTracks;

    let result = [...baseTracks];

    if (debouncedFilter.trim()) {
      const q = debouncedFilter.toLowerCase();
      result = result.filter(
        t => t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q),
      );
    }

    if (!isUserPlaylist) {
      // All Songs gets full sorting
      switch (sortKey) {
        case 'date-desc':
          result.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
          break;
        case 'title-asc':
          result.sort((a, b) => a.title.localeCompare(b.title));
          break;
        case 'artist-asc':
          result.sort((a, b) => a.artist.localeCompare(b.artist));
          break;
        case 'duration-asc':
          result.sort((a, b) => (a.duration ?? 0) - (b.duration ?? 0));
          break;
        case 'duration-desc':
          result.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
          break;
      }
    }
    // User playlist tracks keep their position order (from API)

    return result;
  }, [baseTracks, debouncedFilter, sortKey, isRecentlyPlayed, isUserPlaylist]);

  function handleSortChange(key: LibrarySortKey) {
    setSortKey(key);
    writeLibrarySort(key);
  }

  async function handleDelete(trackId: string) {
    const ok = window.confirm('Delete this track from your library?');
    if (!ok) return;
    await onDeleteTrack(trackId);
    if (!isAllSongs) void loadPlaylistTracks();
  }

  // Drag-and-drop for user playlist reorder
  function handleDragStart(index: number): void {
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number): void {
    e.preventDefault();
    setDragOverIndex(index);
  }

  async function handleDrop(toIndex: number): Promise<void> {
    const fromIndex = dragIndex;
    if (fromIndex === null || fromIndex === toIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...visibleTracks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setPlaylistTracks(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
    try {
      await onReorderTracks?.(reordered.map(t => t.id));
    } catch {
      void loadPlaylistTracks();
    }
  }

  function handleDragEnd(): void {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  const loading = isAllSongs ? libraryLoading : playlistLoading;

  if (!playlist) {
    return <div className="emptyState">Select a playlist to view its tracks.</div>;
  }

  return (
    <div className="playlistDetail">
      <div className="playlistDetailHeader">
        <h2 className="playlistDetailTitle">{playlist.name}</h2>
        {!isRecentlyPlayed ? (
          <div className="libraryControls">
            <div className="libraryFilterWrap">
              <input
                type="search"
                className="libraryFilterInput"
                placeholder="Filter by title or artist…"
                value={filterText}
                onChange={e => setFilterText(e.target.value)}
                aria-label="Filter tracks"
              />
              {filterText ? (
                <button
                  type="button"
                  className="libraryFilterClear"
                  onClick={() => setFilterText('')}
                  aria-label="Clear filter"
                >
                  ✕
                </button>
              ) : null}
            </div>
            {!isUserPlaylist ? (
              <select
                className="librarySortSelect"
                value={sortKey}
                onChange={e => handleSortChange(e.target.value as LibrarySortKey)}
                aria-label="Sort tracks"
                title="Sort order"
              >
                <option value="date-desc">Date added</option>
                <option value="title-asc">Title A–Z</option>
                <option value="artist-asc">Artist A–Z</option>
                <option value="duration-asc">Shortest first</option>
                <option value="duration-desc">Longest first</option>
              </select>
            ) : null}
          </div>
        ) : null}
      </div>

      {loading && baseTracks.length === 0 ? (
        <div className="loadingState">Loading…</div>
      ) : null}

      {!loading && visibleTracks.length === 0 ? (
        <div className="emptyState">
          {debouncedFilter ? 'No tracks match your filter.' : 'No tracks yet. Add songs from your library.'}
        </div>
      ) : null}

      {visibleTracks.length > 0 ? (
        <div className="trackList">
          <div className="trackListHeader">
            <span>#</span>
            <span>Title</span>
            <span className="trackListHeaderDuration">Duration</span>
            <span className="trackListHeaderActions" />
          </div>

          {visibleTracks.map((t, index) => {
            const thumbnailUrl = thumbnailUrlFromTrack(t);
            const audioUrl = audioUrlFromTrack(t);
            const isPlaying = nowPlayingId === t.id;
            const canPlay = t.status === 'ready' && Boolean(audioUrl);
            const inQueue = queueTrackIds.has(t.id);
            const isDragging = dragIndex === index;
            const isOver = dragOverIndex === index && dragIndex !== index;

            return (
              <div
                key={t.id}
                className={`trackRow${canPlay ? ' trackRowPlayable' : ''}${isPlaying ? ' trackRowActive' : ''}${isDragging ? ' trackRowDragging' : ''}${isOver ? ' trackRowDragOver' : ''}`}
                draggable={isUserPlaylist && canPlay}
                onDragStart={isUserPlaylist ? () => handleDragStart(index) : undefined}
                onDragOver={isUserPlaylist ? e => handleDragOver(e, index) : undefined}
                onDrop={isUserPlaylist ? () => { void handleDrop(index); } : undefined}
                onDragEnd={isUserPlaylist ? handleDragEnd : undefined}
                onClick={() => { if (canPlay) onPlayTrack(t); }}
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
                  {isUserPlaylist ? (
                    <span className="trackRowDragHandle" aria-hidden="true">
                      <DragHandleIcon />
                    </span>
                  ) : null}
                  <span className="trackRowIndexNum">{index + 1}</span>
                  {canPlay ? (
                    <button
                      type="button"
                      className="trackRowPlayBtn"
                      aria-label={isPlaying ? 'Playing' : 'Play'}
                      title="Play"
                      onClick={e => { e.stopPropagation(); onPlayTrack(t); }}
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
                    <>
                      <button
                        type="button"
                        className={`iconButton${inQueue ? ' iconButtonActive' : ''}`}
                        aria-label={inQueue ? 'Already in queue' : 'Add to queue'}
                        title={inQueue ? 'Already in queue' : 'Add to queue'}
                        onClick={e => { e.stopPropagation(); onAddToQueue(t); }}
                      >
                        <QueueAddIcon />
                      </button>
                      <button
                        type="button"
                        className="iconButton"
                        aria-label="Play next"
                        title="Play next"
                        onClick={e => { e.stopPropagation(); onPlayNext(t); }}
                      >
                        <PlayNextIcon />
                      </button>
                      <AddToPlaylistMenu
                        track={t}
                        userPlaylists={userPlaylists}
                        onAddToPlaylist={onAddToPlaylist}
                        onCreateAndAdd={onCreateAndAdd}
                      />
                      {isUserPlaylist && onRemoveFromPlaylist ? (
                        <button
                          type="button"
                          className="iconButton"
                          aria-label="Remove from playlist"
                          title="Remove from playlist"
                          onClick={e => {
                            e.stopPropagation();
                            void onRemoveFromPlaylist(t.id);
                          }}
                        >
                          <RemoveFromPlaylistIcon />
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="iconButton iconButtonDanger"
                    aria-label="Delete track"
                    title="Delete track"
                    onClick={e => { e.stopPropagation(); void handleDelete(t.id); }}
                  >
                    <DeleteIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
