import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { formatPlaybackTime } from '../utils/format';

type PlayerProps = {
  audioUrl: string;
  audioRef: RefObject<HTMLAudioElement | null>;
  onEnded?: () => void;
  playKey: number;
  /** When true, load the audio but do not auto-play (used when restoring a previous session) */
  startPaused?: boolean;
  /** If > 0, seek to this position after metadata loads (session restore) */
  restoreTime?: number;
  /** Called once after restoreTime has been applied and the element is paused/ready */
  onRestored?: () => void;
};

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 5h4v14H6zm8 0h4v14h-4z" />
    </svg>
  );
}

export default function Player({
  audioUrl,
  audioRef,
  onEnded,
  playKey,
  startPaused = false,
  restoreTime = 0,
  onRestored,
}: PlayerProps) {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Always-fresh reference to onEnded — avoids re-registering all audio listeners on each render
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  });

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Always reset src on a new playback session — this is the only way to restart playback
    // when the same URL is requested again (e.g. same song queued multiple times or repeated).
    audio.src = audioUrl;
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handleEnded = () => {
      setPlaying(false);
      onEndedRef.current?.();
    };

    const onLoadedMetadata = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      if (restoreTime > 0) {
        audio.currentTime = restoreTime;
        setCurrentTime(restoreTime);
        onRestored?.();
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', handleEnded);

    if (!startPaused) {
      void audio.play().catch(() => {});
    }

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
    // playKey forces this effect to re-run even when audioUrl hasn't changed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioRef, audioUrl, playKey]);

  function togglePlay(): void {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => {});
    else audio.pause();
  }

  function onSeek(value: number): void {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    audio.currentTime = value;
    setCurrentTime(value);
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="playerMinimal">
      <audio ref={audioRef as RefObject<HTMLAudioElement>} className="playerAudioHidden" preload="metadata" />

      <button type="button" className="playerPlayBtn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <div className="playerProgressWrap">
        <input
          type="range"
          className="playerProgress"
          min={0}
          max={duration || 0}
          step={0.1}
          value={currentTime}
          onChange={e => onSeek(Number(e.target.value))}
          aria-label="Seek"
          style={{ '--progress': `${progress}%` } as CSSProperties}
        />
        <div className="playerTimes" aria-hidden="true">
          <span>{formatPlaybackTime(currentTime)}</span>
          <span>{formatPlaybackTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}
