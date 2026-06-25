import type { PlaybackContextSource } from './playbackContext';

export type RepeatMode = 'off' | 'all' | 'one';

export type PlaybackStorageState = {
  nowPlayingId: string | null;
  queueTrackIds: string[];
  currentTime: number;
  repeatMode: RepeatMode;
  shuffleEnabled: boolean;
  volume: number;
  playbackRate: number;
  /** JSON-serializable context origin; tracks are stored separately as IDs */
  playbackContextSource: PlaybackContextSource;
  playbackContextTrackIds: string[];
};

const KEY = 'localflow_playback_v1';

const VALID_REPEAT_MODES: RepeatMode[] = ['off', 'all', 'one'];
const VALID_RATES = [0.75, 1, 1.25, 1.5];

const DEFAULTS: PlaybackStorageState = {
  nowPlayingId: null,
  queueTrackIds: [],
  currentTime: 0,
  repeatMode: 'off',
  shuffleEnabled: false,
  volume: 1,
  playbackRate: 1,
  playbackContextSource: null,
  playbackContextTrackIds: [],
};

export function readPlaybackStorage(): PlaybackStorageState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<PlaybackStorageState>;
    const repeatMode = VALID_REPEAT_MODES.includes(parsed.repeatMode as RepeatMode)
      ? (parsed.repeatMode as RepeatMode)
      : 'off';
    const playbackRate = VALID_RATES.includes(parsed.playbackRate as number)
      ? (parsed.playbackRate as number)
      : 1;
    return {
      nowPlayingId: typeof parsed.nowPlayingId === 'string' ? parsed.nowPlayingId : null,
      queueTrackIds: Array.isArray(parsed.queueTrackIds) ? (parsed.queueTrackIds as string[]) : [],
      currentTime: typeof parsed.currentTime === 'number' ? parsed.currentTime : 0,
      repeatMode,
      shuffleEnabled: Boolean(parsed.shuffleEnabled),
      volume:
        typeof parsed.volume === 'number' ? Math.max(0, Math.min(1, parsed.volume)) : 1,
      playbackRate,
      // Context source is persisted as a plain JSON object; accept it as-is (validated at read site)
      playbackContextSource:
        parsed.playbackContextSource !== undefined
          ? (parsed.playbackContextSource as PlaybackContextSource)
          : null,
      playbackContextTrackIds: Array.isArray(parsed.playbackContextTrackIds)
        ? (parsed.playbackContextTrackIds as string[])
        : [],
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function writePlaybackStorage(patch: Partial<PlaybackStorageState>): void {
  try {
    const raw = localStorage.getItem(KEY);
    const current: PlaybackStorageState = raw
      ? ({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<PlaybackStorageState>) } as PlaybackStorageState)
      : { ...DEFAULTS };
    localStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {
    // Ignore storage errors (private browsing, quota exceeded)
  }
}
