import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Track, TrackStatus, SearchResult, DownloadMeta } from './api/client';
import {
  deleteLibraryTrack,
  downloadFromVideoUrl,
  getLibraryTracks,
  pollDownloadUntilDone,
  searchTracks,
  recordPlayHistory,
} from './api/client';
import Library from './components/Library';
import CreatePlaylistModal from './components/CreatePlaylistModal';
import NowPlayingBar from './components/NowPlayingBar';
import SearchBar from './components/SearchBar';
import SearchResults from './components/SearchResults';
import SettingsMenu from './components/SettingsMenu';
import PasteYouTubeUrl from './components/PasteYouTubeUrl';
import type { LocalflowSettingsV1 } from './settings/localflowSettings';
import {
  applyLocalflowDocumentSettings,
  readLocalflowSettings,
  writeLocalflowSettings,
} from './settings/localflowSettings';
import { usePlaybackEngine } from './playback/usePlaybackEngine';
import type { PlaybackContext } from './playback/playbackContext';
import { useKeyboardShortcuts } from './playback/useKeyboardShortcuts';
import { useMediaSession } from './playback/useMediaSession';
import ToastContainer from './components/Toast';
import { useToast } from './queue/useToast';
import { usePlaylists } from './playlists/usePlaylists';

// One-shot migration: import localStorage history into backend play-history endpoint
const HISTORY_LEGACY_KEY = 'localflow_history_v1';

async function migrateLocalHistory(): Promise<void> {
  try {
    const raw = localStorage.getItem(HISTORY_LEGACY_KEY);
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    if (!Array.isArray(ids) || ids.length === 0) {
      localStorage.removeItem(HISTORY_LEGACY_KEY);
      return;
    }
    // Import in reverse order so the most-recently played ends up on top
    for (const id of [...ids].reverse()) {
      try {
        await recordPlayHistory(id);
      } catch {
        // Ignore missing tracks
      }
    }
    localStorage.removeItem(HISTORY_LEGACY_KEY);
  } catch {
    // Ignore storage/parse errors
  }
}

type TabKey = 'search' | 'library';

type PendingDownload = {
  videoUrl: string;
  trackId: string;
  status: TrackStatus;
  progress: number;
  title: string;
  artist: string;
  thumbnailUrl?: string;
};

export default function App() {
  const [tab, setTab] = useState<TabKey>('library');
  const [settings, setSettings] = useState<LocalflowSettingsV1>(() => readLocalflowSettings());

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [pendingDownloads, setPendingDownloads] = useState<Record<string, PendingDownload>>({});
  const [libraryReloadToken, setLibraryReloadToken] = useState(0);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  // Lifted from Library — tracks managed here so autoplay can access them regardless of active tab
  const [libraryTracks, setLibraryTracks] = useState<Track[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);

  const [recentlyPlayedVersion, setRecentlyPlayedVersion] = useState(0);

  // Incremented when user playlist membership or order changes
  const [playlistTracksVersion, setPlaylistTracksVersion] = useState(0);

  // Playback queue — independent of the main library list; session-only
  const [queue, setQueue] = useState<Track[]>([]);

  const audioRef = useRef<HTMLAudioElement>(null);

  // Playlists managed here (lifted so SearchResults can also use them)
  const {
    playlists,
    createPlaylist,
    renamePlaylist,
    deletePlaylist: doDeletePlaylist,
    addTrack: addTrackToPlaylist,
    removeTrack: removeTrackFromPlaylist,
    reorderTracks: reorderPlaylistTracks,
    reload: reloadPlaylists,
  } = usePlaylists();

  // --- Playback engine ---

  const engine = usePlaybackEngine({ libraryTracks, queue, setQueue, audioRef });

  const {
    nowPlaying,
    playKey,
    startPlayback,
    stopPlayback,
    handleTrackEnded,
    handleNextTrack,
    handlePrevTrack,
    repeatMode,
    cycleRepeat,
    shuffleEnabled,
    toggleShuffle,
    isQueueOpen,
    setIsQueueOpen,
    volume,
    setVolume,
    muted,
    toggleMute,
    playbackRate,
    cyclePlaybackRate,
    upNextTrack,
    restoreTime,
    isRestoring,
    onRestored,
    playbackContext,
  } = engine;

  // --- Queue UX: toasts ---

  const { toasts, addToast } = useToast();

  // --- Keyboard shortcuts (desktop-only; ignored inside text inputs) ---

  useKeyboardShortcuts({
    audioRef,
    hasTrack: Boolean(nowPlaying),
    onPrevTrack: handlePrevTrack,
    onNextTrack: handleNextTrack,
    onCycleRepeat: cycleRepeat,
    onToggleShuffle: toggleShuffle,
    onToggleQueue: () => setIsQueueOpen(prev => !prev),
    onToggleMute: toggleMute,
  });

  // --- Media Session API ---

  useMediaSession({
    track: nowPlaying,
    audioRef,
    onPrev: handlePrevTrack,
    onNext: handleNextTrack,
  });

  // --- Derived ---

  const activeDownloadCount = useMemo(
    () =>
      Object.values(pendingDownloads).filter(
        p => p.status === 'pending' || p.status === 'downloading',
      ).length,
    [pendingDownloads],
  );

  const hasActiveDownloads = useMemo(
    () => libraryTracks.some(t => t.status === 'pending' || t.status === 'downloading'),
    [libraryTracks],
  );

  // Set of track IDs currently in the queue — passed to Library for visual indicators
  const queueTrackIds = useMemo(() => new Set(queue.map(t => t.id)), [queue]);

  // Map from sourceUrl → ready Track — lets SearchResults show "In library" for already-downloaded tracks
  const libraryTracksBySourceUrl = useMemo(() => {
    const map = new Map<string, Track>();
    for (const t of libraryTracks) {
      if (t.sourceUrl && t.status === 'ready') {
        map.set(t.sourceUrl, t);
      }
    }
    return map;
  }, [libraryTracks]);

  useEffect(() => {
    applyLocalflowDocumentSettings(settings);
    writeLocalflowSettings(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.classList.toggle('hasNowPlaying', Boolean(nowPlaying));
    return () => document.documentElement.classList.remove('hasNowPlaying');
  }, [nowPlaying]);

  // On mount: run one-shot history migration
  useEffect(() => {
    void migrateLocalHistory().then(() => {
      // After migration, reload playlists so Recently Played count is accurate
      void reloadPlaylists();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Record play history in backend whenever a new track starts
  useEffect(() => {
    if (!nowPlaying) return;
    void recordPlayHistory(nowPlaying.id).catch(() => {
      // Non-critical; ignore failures silently
    });
    setRecentlyPlayedVersion(v => v + 1);
    // Refresh playlist counts after new play
    void reloadPlaylists();
  }, [nowPlaying?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Library tracks loading (lifted from Library component) ---

  const loadLibraryTracks = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const resp = await getLibraryTracks(100, 0);
      setLibraryTracks(resp.tracks || []);
    } catch (err) {
      setLibraryError(err instanceof Error ? err.message : 'Unknown error');
      setLibraryTracks([]);
    } finally {
      setLibraryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibraryTracks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryReloadToken]);

  // Poll while any track is still being processed
  useEffect(() => {
    if (!hasActiveDownloads) return undefined;
    const intervalId = window.setInterval(() => { void loadLibraryTracks(); }, 2500);
    return () => window.clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveDownloads, libraryReloadToken]);

  // --- Queue management ---

  function truncateTitle(title: string): string {
    return title.length > 36 ? `${title.slice(0, 36)}…` : title;
  }

  function handleAddToQueue(track: Track): void {
    setQueue(prev => [...prev, track]);
    addToast(`Added to queue: ${truncateTitle(track.title)}`);
  }

  // Insert a track at the front of the queue so it plays next.
  // If nothing is playing, start it immediately (no context — queue/play-next is context-agnostic).
  function handlePlayNext(track: Track): void {
    if (!nowPlaying) {
      startPlayback(track);
      return;
    }
    setQueue(prev => [track, ...prev]);
    addToast(`Play next: ${truncateTitle(track.title)}`);
  }

  function handleRemoveFromQueue(index: number): void {
    setQueue(prev => prev.filter((_, i) => i !== index));
  }

  function handleReorderQueue(from: number, to: number): void {
    setQueue(prev => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  function handleClearQueue(): void {
    setQueue([]);
  }

  /** Central play-track entry point — routes context from PlaylistDetail / SearchResults to the engine. */
  function handlePlayTrack(track: Track, context?: PlaybackContext): void {
    startPlayback(track, context);
  }

  // --- Search ---

  async function handleSearch(q: string): Promise<void> {
    const query = q.trim();
    if (!query) return;

    setSearchQuery(query);
    setSearchLoading(true);
    setSearchError(null);

    try {
      const results = await searchTracks(query, 10);
      setSearchResults(results);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setSearchError(message);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  function handleClearSearch(): void {
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
  }

  const updatePending = useCallback((videoUrl: string, patch: Partial<PendingDownload>) => {
    setPendingDownloads(prev => {
      const existing = prev[videoUrl];
      if (!existing) return prev;
      return { ...prev, [videoUrl]: { ...existing, ...patch } };
    });
  }, []);

  async function handleDownload(videoUrl: string, meta?: DownloadMeta): Promise<void> {
    if (!videoUrl) return;

    const existing = pendingDownloads[videoUrl];
    if (existing && existing.status !== 'error') return;

    setSearchError(null);
    setDownloadNotice(null);

    setPendingDownloads(prev => ({
      ...prev,
      [videoUrl]: {
        videoUrl,
        trackId: existing?.trackId ?? '',
        status: 'pending',
        progress: 0,
        title: meta?.title ?? existing?.title ?? 'Starting download...',
        artist: meta?.artist ?? existing?.artist ?? '',
        thumbnailUrl: meta?.thumbnailUrl ?? existing?.thumbnailUrl,
      },
    }));

    try {
      const { track: started } = await downloadFromVideoUrl(videoUrl);

      setPendingDownloads(prev => ({
        ...prev,
        [videoUrl]: {
          videoUrl,
          trackId: started.id,
          status: started.status,
          progress: started.progress ?? 0,
          title: meta?.title ?? started.title,
          artist: meta?.artist ?? started.artist,
          thumbnailUrl: meta?.thumbnailUrl,
        },
      }));

      setLibraryReloadToken(t => t + 1);

      if (started.status === 'ready') {
        setDownloadNotice(`"${meta?.title ?? started.title}" is already in your library.`);
        setTab('library');
        setPendingDownloads(prev => {
          const next = { ...prev };
          delete next[videoUrl];
          return next;
        });
        return;
      }

      const finalTrack = await pollDownloadUntilDone(
        started.id,
        track => {
          updatePending(videoUrl, {
            status: track.status,
            progress: track.progress ?? 0,
            title: track.title || meta?.title || 'Downloading...',
            artist: track.artist || meta?.artist || '',
          });
          if (track.status === 'downloading' || track.status === 'pending') {
            setLibraryReloadToken(t => t + 1);
          }
        },
        1500,
      );

      if (finalTrack.status === 'error') {
        throw new Error(finalTrack.message || 'Download failed');
      }

      setLibraryReloadToken(t => t + 1);
      void reloadPlaylists();
      setDownloadNotice(`"${finalTrack.title}" added to your library.`);
      setTab('library');
      setPendingDownloads(prev => {
        const next = { ...prev };
        delete next[videoUrl];
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Download failed';
      setPendingDownloads(prev => ({
        ...prev,
        [videoUrl]: {
          videoUrl,
          trackId: prev[videoUrl]?.trackId ?? '',
          status: 'error',
          progress: 0,
          title: meta?.title ?? prev[videoUrl]?.title ?? 'Download failed',
          artist: meta?.artist ?? prev[videoUrl]?.artist ?? '',
          thumbnailUrl: meta?.thumbnailUrl ?? prev[videoUrl]?.thumbnailUrl,
        },
      }));
      setDownloadNotice(message);
      setSearchError(message);
    }
  }

  async function handleDeleteTrack(trackId: string): Promise<void> {
    // Optimistic update before the API call for instant UI feedback
    setLibraryTracks(prev => prev.filter(t => t.id !== trackId));
    setQueue(prev => prev.filter(t => t.id !== trackId));

    if (nowPlaying?.id === trackId) {
      stopPlayback();
    }

    await deleteLibraryTrack(trackId);
    setLibraryReloadToken(t => t + 1);
    void reloadPlaylists();
  }

  // --- Playlist actions ---

  async function handleAddToPlaylist(playlistId: string, track: Track): Promise<void> {
    const playlist = playlists.find(p => p.id === playlistId);
    const { alreadyExists } = await addTrackToPlaylist(playlistId, track.id);
    if (alreadyExists) {
      addToast(`Already in ${playlist?.name ?? 'playlist'}`);
    } else {
      addToast(`Added to ${playlist?.name ?? 'playlist'}: ${truncateTitle(track.title)}`);
      setPlaylistTracksVersion(v => v + 1);
    }
  }

  async function handleRenamePlaylist(id: string, name: string): Promise<void> {
    await renamePlaylist(id, name);
  }

  async function handleDeletePlaylist(id: string): Promise<void> {
    await doDeletePlaylist(id);
    setPlaylistTracksVersion(v => v + 1);
  }

  async function handleRemoveFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    await removeTrackFromPlaylist(playlistId, trackId);
    addToast('Removed from playlist');
    setPlaylistTracksVersion(v => v + 1);
  }

  async function handleReorderPlaylistTracks(playlistId: string, trackIds: string[]): Promise<void> {
    await reorderPlaylistTracks(playlistId, trackIds);
    setPlaylistTracksVersion(v => v + 1);
  }

  const userPlaylists = useMemo(() => playlists.filter(p => p.kind === 'user'), [playlists]);

  const [createPlaylistForTrack, setCreatePlaylistForTrack] = useState<Track | null>(null);

  function handleCreateAndAdd(track: Track): void {
    setCreatePlaylistForTrack(track);
  }

  async function handleCreatePlaylistForTrack(name: string): Promise<void> {
    const track = createPlaylistForTrack;
    setCreatePlaylistForTrack(null);
    const pl = await createPlaylist(name);
    if (pl && track) {
      await handleAddToPlaylist(pl.id, track);
    }
  }

  return (
    <div className="appShell">
      <div className="appMain">
        <div className="container">
          <div className="topbar">
            <div className="brand">LocalFlow</div>
            <div className="topbarRight">
              <div className="tabs" role="tablist" aria-label="Main tabs">
                <button
                  className="tabButton"
                  role="tab"
                  aria-selected={tab === 'library'}
                  onClick={() => setTab('library')}
                >
                  Library
                  {activeDownloadCount > 0 ? (
                    <span className="tabBadge">{activeDownloadCount}</span>
                  ) : null}
                </button>
                <button
                  className="tabButton"
                  role="tab"
                  aria-selected={tab === 'search'}
                  onClick={() => setTab('search')}
                >
                  Search
                </button>
              </div>
              <SettingsMenu settings={settings} onApply={setSettings} />
            </div>
          </div>

          {downloadNotice ? (
            <div
              className={`downloadNotice ${downloadNotice.toLowerCase().includes('fail') || downloadNotice.toLowerCase().includes('error') ? 'downloadNoticeError' : ''}`}
              role="status"
            >
              {downloadNotice}
              <button type="button" className="downloadNoticeDismiss" onClick={() => setDownloadNotice(null)}>
                Dismiss
              </button>
            </div>
          ) : null}

          {activeDownloadCount > 0 ? (
            <div className="downloadNotice downloadNoticeInfo" role="status">
              Downloading {activeDownloadCount} track{activeDownloadCount === 1 ? '' : 's'}…
            </div>
          ) : null}

          {tab === 'search' ? (
            <div className="page">
              <h1 className="pageTitle">Search</h1>

              <SearchBar
                onSearch={handleSearch}
                onClear={handleClearSearch}
                canClear={Boolean(searchQuery || searchResults.length || searchError)}
                isLoading={searchLoading}
                initialValue={searchQuery}
              />

              <div className="pageSection">
                <p className="pageSectionLabel">Or paste a link</p>
                <PasteYouTubeUrl onDownload={handleDownload} pendingDownloads={pendingDownloads} />
              </div>

              {searchError ? <div className="errorBox" style={{ marginTop: 16 }}>{searchError}</div> : null}

              <div className="pageSection">
                <SearchResults
                  results={searchResults}
                  isLoading={searchLoading}
                  pendingDownloads={pendingDownloads}
                  onDownload={handleDownload}
                  libraryTracksBySourceUrl={libraryTracksBySourceUrl}
                  onPlayTrack={(track) =>
                    startPlayback(track, { source: { type: 'search' }, tracks: [track] })
                  }
                  onAddToQueue={handleAddToQueue}
                  userPlaylists={userPlaylists}
                  onAddToPlaylist={handleAddToPlaylist}
                  onCreateAndAdd={handleCreateAndAdd}
                />
              </div>
            </div>
          ) : (
            <Library
              tracks={libraryTracks}
              loading={libraryLoading}
              error={libraryError}
              playlists={playlists}
              onDeleteTrack={handleDeleteTrack}
              onPlayTrack={handlePlayTrack}
              onPlayNext={handlePlayNext}
              nowPlayingId={nowPlaying?.id ?? null}
              onAddToQueue={handleAddToQueue}
              queueTrackIds={queueTrackIds}
              recentlyPlayedVersion={recentlyPlayedVersion}
              onAddToPlaylist={handleAddToPlaylist}
              onCreatePlaylist={createPlaylist}
              onRenamePlaylist={handleRenamePlaylist}
              onDeletePlaylist={handleDeletePlaylist}
              onRemoveFromPlaylist={handleRemoveFromPlaylist}
              onReorderPlaylistTracks={handleReorderPlaylistTracks}
              playlistTracksVersion={playlistTracksVersion}
            />
          )}
        </div>
      </div>

      {nowPlaying ? (
        <NowPlayingBar
          track={nowPlaying}
          playKey={playKey}
          audioRef={audioRef}
          onClose={stopPlayback}
          onEnded={handleTrackEnded}
          onPrevTrack={handlePrevTrack}
          onNextTrack={handleNextTrack}
          queue={queue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onReorderQueue={handleReorderQueue}
          onClearQueue={handleClearQueue}
          repeatMode={repeatMode}
          onCycleRepeat={cycleRepeat}
          shuffleEnabled={shuffleEnabled}
          onToggleShuffle={toggleShuffle}
          volume={volume}
          onVolumeChange={setVolume}
          muted={muted}
          onToggleMute={toggleMute}
          playbackRate={playbackRate}
          onCyclePlaybackRate={cyclePlaybackRate}
          upNextTrack={upNextTrack}
          isQueueOpen={isQueueOpen}
          onSetQueueOpen={setIsQueueOpen}
          restoreTime={restoreTime}
          startPaused={isRestoring}
          onRestored={onRestored}
          playbackContext={playbackContext}
          onBrowseLibrary={() => setTab('library')}
          onAddToQueue={handleAddToQueue}
        />
      ) : null}

      <ToastContainer toasts={toasts} />

      {createPlaylistForTrack ? (
        <CreatePlaylistModal
          onConfirm={name => { void handleCreatePlaylistForTrack(name); }}
          onCancel={() => setCreatePlaylistForTrack(null)}
          title="New playlist"
        />
      ) : null}
    </div>
  );
}
