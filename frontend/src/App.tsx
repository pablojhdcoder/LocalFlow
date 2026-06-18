import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Track, TrackStatus, SearchResult, DownloadMeta } from './api/client';
import {
  deleteLibraryTrack,
  downloadFromVideoUrl,
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

  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const activeDownloadCount = useMemo(
    () =>
      Object.values(pendingDownloads).filter(
        p => p.status === 'pending' || p.status === 'downloading',
      ).length,
    [pendingDownloads],
  );

  useEffect(() => {
    applyLocalflowDocumentSettings(settings);
    writeLocalflowSettings(settings);
  }, [settings]);

  useEffect(() => {
    document.documentElement.classList.toggle('hasNowPlaying', Boolean(nowPlaying));
    return () => document.documentElement.classList.remove('hasNowPlaying');
  }, [nowPlaying]);

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
    await deleteLibraryTrack(trackId);
    if (nowPlaying?.id === trackId) setNowPlaying(null);
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
              reloadToken={libraryReloadToken}
              onDeleteTrack={handleDeleteTrack}
              onPlayTrack={setNowPlaying}
              nowPlayingId={nowPlaying?.id ?? null}
            />
          )}
        </div>
      </div>

      {nowPlaying ? (
        <NowPlayingBar
          track={nowPlaying}
          audioRef={audioRef}
          onClose={() => {
            audioRef.current?.pause();
            setNowPlaying(null);
          }}
        />
      ) : null}
    </div>
  );
}
