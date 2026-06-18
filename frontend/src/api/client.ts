export type TrackStatus = 'pending' | 'downloading' | 'ready' | 'error';

export type ApiErrorPayload = {
  error?: string;
  message?: string;
};

export type SearchResult = {
  id?: string;
  title: string;
  artist: string;
  duration?: number;
  thumbnailUrl?: string;
  videoUrl: string;
};

export type DownloadMeta = {
  title?: string;
  artist?: string;
  thumbnailUrl?: string;
};

export type Track = {
  id: string;
  title: string;
  artist: string;
  duration?: number;
  status: TrackStatus;
  progress?: number;
  message?: string;
  sourceUrl?: string;
  audioUrl?: string;
  thumbnailUrl?: string;
  audioPath?: string;
  thumbnailPath?: string;
};

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

export function getApiBaseUrl(): string {
  const envBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  return envBase ? normalizeBaseUrl(envBase) : '';
}

function pathToFilename(input: string): string {
  const normalized = input.replace(/\\/g, '/');
  const match = normalized.match(/([^/]+)$/);
  return match ? match[1] : normalized;
}

export function audioUrlFromTrack(track: Pick<Track, 'audioUrl' | 'audioPath'>): string | undefined {
  if (track.audioUrl) return track.audioUrl;
  if (!track.audioPath) return undefined;
  const filename = pathToFilename(track.audioPath);
  if (!filename) return undefined;
  return `${getApiBaseUrl()}/audio/${encodeURIComponent(filename)}`;
}

export function thumbnailUrlFromTrack(
  track: Pick<Track, 'thumbnailUrl' | 'thumbnailPath'>,
): string | undefined {
  if (track.thumbnailUrl) return track.thumbnailUrl;
  if (!track.thumbnailPath) return undefined;
  const filename = pathToFilename(track.thumbnailPath);
  return `${getApiBaseUrl()}/thumbnails/${encodeURIComponent(filename)}`;
}

export class ApiClientError extends Error {
  public status?: number;
  public payload?: ApiErrorPayload;

  constructor(message: string, status?: number, payload?: ApiErrorPayload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

async function parseJsonSafe(resp: Response): Promise<unknown> {
  const text = await resp.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${getApiBaseUrl()}${path.startsWith('/') ? '' : '/'}${path}`;

  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const resp = await fetch(url, { ...init, headers });

  if (!resp.ok) {
    const payload = (await parseJsonSafe(resp)) as ApiErrorPayload;
    throw new ApiClientError(
      payload?.message || payload?.error || `Request failed (${resp.status})`,
      resp.status,
      payload,
    );
  }

  return (await parseJsonSafe(resp)) as T;
}

export async function searchTracks(q: string, limit: number): Promise<SearchResult[]> {
  const searchParams = new URLSearchParams({ q, limit: String(limit) });
  const data = await apiRequest<unknown>(`/api/search?${searchParams.toString()}`);

  if (Array.isArray(data)) return data as SearchResult[];
  const container = data as Record<string, unknown>;
  const candidates =
    (container.results as unknown) ??
    (container.tracks as unknown) ??
    (container.items as unknown) ??
    null;

  if (Array.isArray(candidates)) return candidates as SearchResult[];
  return [];
}

export async function downloadFromVideoUrl(videoUrl: string): Promise<{
  track: Pick<Track, 'id' | 'title' | 'artist' | 'status' | 'sourceUrl' | 'progress'>;
}> {
  return apiRequest(`/api/download`, {
    method: 'POST',
    body: JSON.stringify({ videoUrl }),
  });
}

export async function getDownloadStatus(trackId: string): Promise<{ track: Track }> {
  return apiRequest(`/api/download/${encodeURIComponent(trackId)}`, { method: 'GET' });
}

export async function getLibraryTracks(limit: number, offset: number): Promise<{
  tracks: Track[];
  total?: number;
}> {
  const searchParams = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiRequest(`/api/library/tracks?${searchParams.toString()}`, { method: 'GET' });
}

export async function deleteLibraryTrack(trackId: string): Promise<{ message?: string }> {
  return apiRequest(`/api/library/tracks/${encodeURIComponent(trackId)}`, { method: 'DELETE' });
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function pollDownloadUntilDone(
  trackId: string,
  onUpdate?: (track: Track) => void,
  intervalMs = 2000,
  timeoutMs = 600_000,
): Promise<Track> {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const { track } = await getDownloadStatus(trackId);
    onUpdate?.(track);

    if (track.status === 'ready' || track.status === 'error') {
      return track;
    }

    await sleep(intervalMs);
  }

  throw new Error('Download timed out');
}
