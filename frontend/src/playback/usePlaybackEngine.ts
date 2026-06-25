import { useEffect, useMemo, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react';
import type { Track } from '../api/client';
import { audioUrlFromTrack } from '../api/client';
import { readPlaybackStorage, writePlaybackStorage, type RepeatMode } from './playbackStorage';
import type { PlaybackContext } from './playbackContext';

export type { RepeatMode };
export type { PlaybackContext };

const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;

type PlaybackEngineOptions = {
  libraryTracks: Track[];
  queue: Track[];
  setQueue: Dispatch<SetStateAction<Track[]>>;
  audioRef: RefObject<HTMLAudioElement | null>;
};

export type PlaybackEngine = {
  nowPlaying: Track | null;
  playKey: number;
  /** Start playing a track. Pass `context` to drive subsequent prev/next within that set. */
  startPlayback: (track: Track, context?: PlaybackContext) => void;
  stopPlayback: () => void;
  handleTrackEnded: () => void;
  handleNextTrack: () => void;
  handlePrevTrack: () => void;
  repeatMode: RepeatMode;
  cycleRepeat: () => void;
  shuffleEnabled: boolean;
  toggleShuffle: () => void;
  isQueueOpen: boolean;
  setIsQueueOpen: Dispatch<SetStateAction<boolean>>;
  volume: number;
  setVolume: (v: number) => void;
  muted: boolean;
  toggleMute: () => void;
  playbackRate: number;
  cyclePlaybackRate: () => void;
  upNextTrack: Track | null;
  restoreTime: number;
  isRestoring: boolean;
  onRestored: () => void;
  /** The playback context set on the last explicit user-initiated play action. */
  playbackContext: PlaybackContext | null;
};

export function usePlaybackEngine({
  libraryTracks,
  queue,
  setQueue,
  audioRef,
}: PlaybackEngineOptions): PlaybackEngine {
  // Read persisted state once on mount — the ref ensures we only parse once
  const savedStateRef = useRef(readPlaybackStorage());
  const saved = savedStateRef.current;

  const [nowPlaying, setNowPlaying] = useState<Track | null>(null);
  const [playKey, setPlayKey] = useState(0);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>(saved.repeatMode);
  const [shuffleEnabled, setShuffleEnabled] = useState(saved.shuffleEnabled);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [volume, setVolumeState] = useState(saved.volume);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(saved.playbackRate);

  // Playback context — only set when user explicitly starts a track; cleared on stop.
  // Not persisted: playlist tracks would need to be re-fetched on restore.
  const [playbackContext, setPlaybackContext] = useState<PlaybackContext | null>(null);

  // Restore-on-load state: after the initial library fetch, restore the previous session paused
  const hasRestoredRef = useRef(false);
  const [restoreTime, setRestoreTime] = useState(0);
  const [isRestoring, setIsRestoring] = useState(false);

  // Shuffle history stack — max 50 entries, maintained as a ref (no render needed)
  const playedHistoryRef = useRef<Track[]>([]);

  // Throttle: track the last time we persisted currentTime to avoid excessive writes
  const lastTimeSaveRef = useRef(0);

  // --- Helpers ---

  function getPlayableTracks(): Track[] {
    return libraryTracks.filter(t => t.status === 'ready' && Boolean(audioUrlFromTrack(t)));
  }

  /** Returns context tracks if a context is set, otherwise falls back to the full library. */
  function getContextTracks(): Track[] {
    if (playbackContext && playbackContext.tracks.length > 0) {
      return playbackContext.tracks;
    }
    return getPlayableTracks();
  }

  // --- Restore previous session after initial library load ---

  useEffect(() => {
    if (hasRestoredRef.current) return;
    if (libraryTracks.length === 0) return;

    hasRestoredRef.current = true;

    const { nowPlayingId, queueTrackIds, currentTime } = savedStateRef.current;

    // Restore queue order, skipping any tracks that no longer exist or aren't ready
    if (queueTrackIds.length > 0) {
      const restoredQueue = queueTrackIds
        .map(id => libraryTracks.find(t => t.id === id))
        .filter((t): t is Track => t !== undefined && t.status === 'ready');
      if (restoredQueue.length > 0) setQueue(restoredQueue);
    }

    // Restore now-playing, but do NOT auto-play — safer UX on reload
    if (nowPlayingId) {
      const track = libraryTracks.find(t => t.id === nowPlayingId && t.status === 'ready');
      if (track) {
        setNowPlaying(track);
        setPlayKey(k => k + 1);
        if (currentTime > 0.5) {
          setRestoreTime(currentTime);
          setIsRestoring(true);
        }
      }
    }
  // Intentionally only runs once when libraryTracks first becomes non-empty
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libraryTracks]);

  // Called by Player after it has seeked to restoreTime and is ready (but paused)
  function onRestored(): void {
    setIsRestoring(false);
    setRestoreTime(0);
  }

  // --- Apply volume / mute to the shared audio element ---

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
  }, [volume, muted, audioRef]);

  // Re-apply after each new playback session (src resets do not reset volume, but be explicit)
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = muted ? 0 : volume;
    audio.playbackRate = playbackRate;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playKey]);

  // --- Apply playback rate ---

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackRate;
  }, [playbackRate, audioRef]);

  // --- Persist currentTime on timeupdate (throttled to every 5 s) ---

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    function onTimeUpdate(): void {
      const now = Date.now();
      if (now - lastTimeSaveRef.current < 5000) return;
      lastTimeSaveRef.current = now;
      writePlaybackStorage({ currentTime: audio!.currentTime });
    }

    audio.addEventListener('timeupdate', onTimeUpdate);
    return () => audio.removeEventListener('timeupdate', onTimeUpdate);
  // Re-register when playKey changes so we always have a listener for the current src
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef, playKey]);

  // Save currentTime immediately on page unload
  useEffect(() => {
    function onBeforeUnload(): void {
      const audio = audioRef.current;
      if (audio) writePlaybackStorage({ currentTime: audio.currentTime });
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [audioRef]);

  // --- Persist settings whenever they change ---

  useEffect(() => {
    writePlaybackStorage({ repeatMode, shuffleEnabled, volume, playbackRate });
  }, [repeatMode, shuffleEnabled, volume, playbackRate]);

  useEffect(() => {
    writePlaybackStorage({
      nowPlayingId: nowPlaying?.id ?? null,
      queueTrackIds: queue.map(t => t.id),
    });
  }, [nowPlaying, queue]);

  // --- Playback functions ---

  /**
   * Internal helper — separates history-push control from the public API.
   * Does NOT update playbackContext; callers that need a context change use startPlayback().
   */
  function _advance(track: Track, pushHistory: boolean): void {
    if (pushHistory && nowPlaying && nowPlaying.id !== track.id) {
      playedHistoryRef.current = [nowPlaying, ...playedHistoryRef.current].slice(0, 50);
    }
    setNowPlaying(track);
    setPlayKey(k => k + 1);
    setIsRestoring(false);
    setRestoreTime(0);
  }

  /**
   * Public API: start a track, optionally setting a new playback context.
   * Always pushes the previous track to shuffle history.
   */
  function startPlayback(track: Track, context?: PlaybackContext): void {
    if (context !== undefined) {
      setPlaybackContext(context);
    }
    _advance(track, true);
  }

  function stopPlayback(): void {
    audioRef.current?.pause();
    setNowPlaying(null);
    setPlaybackContext(null);
  }

  /**
   * Advance to the next track.
   * Queue always wins. repeat-one only triggers on natural track end (allowRepeatOne=true),
   * not on explicit Next press.
   * Navigation stays within playbackContext.tracks when a context is set.
   */
  function advancePlayback(allowRepeatOne: boolean): void {
    // Queue has priority over everything
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      _advance(next, true);
      return;
    }

    if (!nowPlaying) {
      setNowPlaying(null);
      return;
    }

    if (allowRepeatOne && repeatMode === 'one') {
      setPlayKey(k => k + 1);
      return;
    }

    // Navigate within context tracks (or library if no context)
    const playable = getContextTracks();

    if (playable.length === 0) {
      setNowPlaying(null);
      return;
    }

    if (shuffleEnabled) {
      const others = playable.filter(t => t.id !== nowPlaying.id);
      if (others.length === 0) {
        if (repeatMode === 'all') setPlayKey(k => k + 1);
        else setNowPlaying(null);
        return;
      }
      const randomIndex = Math.floor(Math.random() * others.length);
      _advance(others[randomIndex], true);
      return;
    }

    const currentIndex = playable.findIndex(t => t.id === nowPlaying.id);

    if (currentIndex !== -1 && currentIndex < playable.length - 1) {
      _advance(playable[currentIndex + 1], true);
      return;
    }

    // At the end of the context/library
    if (repeatMode === 'all') {
      _advance(playable[0], true);
    } else {
      setNowPlaying(null);
    }
  }

  function handleTrackEnded(): void {
    advancePlayback(true);
  }

  function handleNextTrack(): void {
    advancePlayback(false);
  }

  function handlePrevTrack(): void {
    const audio = audioRef.current;

    // If more than 3 s into the track, restart rather than skipping back
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    // Shuffle mode: walk back through the history stack
    if (shuffleEnabled && playedHistoryRef.current.length > 0) {
      const prev = playedHistoryRef.current[0];
      playedHistoryRef.current = playedHistoryRef.current.slice(1);
      _advance(prev, false);
      return;
    }

    if (!nowPlaying) {
      if (audio) audio.currentTime = 0;
      return;
    }

    // Navigate within context tracks (or library if no context)
    const playable = getContextTracks();
    const currentIndex = playable.findIndex(t => t.id === nowPlaying.id);

    if (currentIndex <= 0) {
      if (audio) audio.currentTime = 0;
      return;
    }

    _advance(playable[currentIndex - 1], false);
  }

  function cycleRepeat(): void {
    setRepeatMode(prev => (prev === 'off' ? 'all' : prev === 'all' ? 'one' : 'off'));
  }

  function toggleShuffle(): void {
    setShuffleEnabled(prev => !prev);
    // Clear the history stack when toggling shuffle so prev-track behaves consistently
    playedHistoryRef.current = [];
  }

  function setVolume(v: number): void {
    setVolumeState(Math.max(0, Math.min(1, v)));
    // Unmute when volume is explicitly changed
    setMuted(false);
  }

  function toggleMute(): void {
    setMuted(prev => !prev);
  }

  function cyclePlaybackRate(): void {
    setPlaybackRateState(prev => {
      const idx = PLAYBACK_RATES.indexOf(prev as (typeof PLAYBACK_RATES)[number]);
      return PLAYBACK_RATES[(idx + 1) % PLAYBACK_RATES.length];
    });
  }

  // --- Up next computation ---

  const upNextTrack = useMemo((): Track | null => {
    // Queue always takes priority for "up next"
    if (queue.length > 0) return queue[0];

    if (!nowPlaying) return null;

    // In shuffle mode with no queue, the next pick is unpredictable — don't show
    if (shuffleEnabled) return null;

    // repeat-one: the same track plays next
    if (repeatMode === 'one') return nowPlaying;

    // Use context tracks when available, otherwise the full library
    const playable = playbackContext && playbackContext.tracks.length > 0
      ? playbackContext.tracks
      : libraryTracks.filter(t => t.status === 'ready' && Boolean(audioUrlFromTrack(t)));

    const currentIndex = playable.findIndex(t => t.id === nowPlaying.id);

    if (currentIndex !== -1 && currentIndex < playable.length - 1) {
      return playable[currentIndex + 1];
    }

    // At the end: repeat-all loops back to the first track in the context
    if (repeatMode === 'all' && playable.length > 0) {
      return playable[0];
    }

    return null;
  }, [queue, nowPlaying, libraryTracks, shuffleEnabled, repeatMode, playbackContext]);

  return {
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
  };
}
