import { useState } from 'react';
import type { TrackStatus, DownloadMeta } from '../api/client';

type PendingDownload = {
  videoUrl: string;
  trackId: string;
  status: TrackStatus;
  title: string;
  artist: string;
  thumbnailUrl?: string;
};

type PasteYouTubeUrlProps = {
  onDownload: (videoUrl: string, meta?: DownloadMeta) => void;
  pendingDownloads: Record<string, PendingDownload>;
};

function looksLikeYouTubeUrl(raw: string): boolean {
  const text = raw.trim();
  if (!text) return false;

  // Simple heuristic: common URL patterns that include a video id.
  const patterns: RegExp[] = [
    /^(https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})(&.*)?$/i,
    /^(https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})(\?.*)?$/i,
    /^(https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})(\?.*)?$/i,
    /^(https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{6,})(\?.*)?$/i,
  ];

  return patterns.some(r => r.test(text));
}

export default function PasteYouTubeUrl({ onDownload, pendingDownloads }: PasteYouTubeUrlProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Pending state is keyed by the exact `videoUrl` we pass to the backend.
  const trimmed = value.trim();
  const pending = trimmed ? pendingDownloads[trimmed] : undefined;
  const isBlocked = Boolean(pending && pending.status !== 'error');

  function submit(): void {
    const raw = value.trim();
    if (!raw) return;

    if (!looksLikeYouTubeUrl(raw)) {
      setError('Please paste a valid YouTube URL.');
      return;
    }

    setError(null);
    const pending = pendingDownloads[raw];
    if (pending && pending.status !== 'error') return;
    onDownload(raw);
    setValue('');
  }

  return (
    <div className="pasteUrlRow">
      <form
        className="searchRow"
        onSubmit={e => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="searchField">
          <input
            className="searchInput searchInputPlain"
            value={value}
            placeholder="Paste a YouTube URL"
            onChange={e => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            inputMode="url"
          />
        </div>
        <button
          className="button buttonPrimary"
          type="submit"
          disabled={!trimmed || isBlocked}
          aria-disabled={!trimmed || isBlocked}
        >
          {pending?.status === 'error' ? 'Retry' : pending ? 'Downloading...' : 'Add'}
        </button>
      </form>

      {error ? (
        <div className="pasteUrlError" role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

