import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Track, TrackStatus, SearchResult, DownloadMeta } from './api/client';
import {
  audioUrlFromTrack,
  deleteLibraryTrack,
  downloadFromVideoUrl,
  getLibraryTracks,
  pollDownloadUntilDone,
  searchTracks,
} from './api/client';
import Library from './components/Library';
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

  // Playback queue — independent of the main library list; session-only (not persisted)
  const [queue, setQueue] = useState<Track[]>([]);

  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  // Incremented on every new playback session so Player restarts even when the URL is identical
  const [playKey, setPlayKey] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Use this instead of setNowPlaying when starting a track (not when stopping)
  function startPlayback(track: Track): void {
    setNowPlaying(track);
    setPlayKey(k => k + 1);
  }

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

  useEffect(() => {
    applyLocalflowDocumentSettings(settings);
    writeLocalflowSettings(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.classList.toggle('hasNowPlaying', Boolean(nowPlaying));
    return () => document.documentElement.classList.remove('hasNowPlaying');
  }, [nowPlaying]);

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

  // --- Playback navigation helpers ---

  // Returns the list of ready tracks in visual (library) order, used for prev/next logic
  function getPlayableTracks(): Track[] {
    return libraryTracks.filter(t => t.status === 'ready' && Boolean(audioUrlFromTrack(t)));
  }

  // Called when a song ends naturally (autoplay) or the user presses Next
  function handleTrackEnded(): void {
    // Queue has priority over the library list
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      startPlayback(next);
      return;
    }

    // Fall back to sequential playback in library order (created_at DESC → visual top-to-bottom)
    if (!nowPlaying || libraryTracks.length === 0) {
      setNowPlaying(null);
      return;
    }

    const playable = getPlayableTracks();

    if (playable.length === 0) {
      setNowPlaying(null);
      return;
    }

    const currentIndex = playable.findIndex(t => t.id === nowPlaying.id);

    // Stop at the end of the list or if the current track isn't found
    if (currentIndex === -1 || currentIndex >= playable.length - 1) {
      setNowPlaying(null);
      return;
    }

    startPlayback(playable[currentIndex + 1]);
  }

  function handleNextTrack(): void {
    handleTrackEnded();
  }

  function handlePrevTrack(): void {
    const audio = audioRef.current;

    // If more than 3 s into the track, restart rather than skipping back
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    if (!nowPlaying) {
      if (audio) audio.currentTime = 0;
      return;
    }

    const playable = getPlayableTracks();
    const currentIndex = playable.findIndex(t => t.id === nowPlaying.id);

    if (currentIndex <= 0) {
      // Already at the first track or track came from queue — just restart
      if (audio) audio.currentTime = 0;
      return;
    }

    startPlayback(playable[currentIndex - 1]);
  }

  // --- Queue management ---

  function handleAddToQueue(track: Track): void {
    setQueue(prev => [...prev, track]);
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
      audioRef.current?.pause();
      setNowPlaying(null);
    }

    await deleteLibraryTrack(trackId);
    setLibraryReloadToken(t => t + 1);
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
                />
              </div>
            </div>
          ) : (
            <Library
              tracks={libraryTracks}
              loading={libraryLoading}
              error={libraryError}
              onDeleteTrack={handleDeleteTrack}
              onPlayTrack={startPlayback}
              nowPlayingId={nowPlaying?.id ?? null}
              onAddToQueue={handleAddToQueue}
              queueTrackIds={queueTrackIds}
            />
          )}
        </div>
      </div>

      {nowPlaying ? (
        <NowPlayingBar
          track={nowPlaying}
          playKey={playKey}
          audioRef={audioRef}
          onClose={() => {
            audioRef.current?.pause();
            setNowPlaying(null);
          }}
          onEnded={handleTrackEnded}
          onPrevTrack={handlePrevTrack}
          onNextTrack={handleNextTrack}
          queue={queue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onReorderQueue={handleReorderQueue}
          onClearQueue={handleClearQueue}
        />
      ) : null}
    </div>
  );
}
