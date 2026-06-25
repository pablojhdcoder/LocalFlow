import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { Track } from '../api/client';
import { audioUrlFromTrack, thumbnailUrlFromTrack } from '../api/client';
import { formatDurationSeconds } from '../utils/format';
import type { RepeatMode } from '../playback/usePlaybackEngine';
import type { PlaybackContext } from '../playback/playbackContext';
import Player from './Player';

type NowPlayingBarProps = {
  track: Track;
  playKey: number;
  audioRef: RefObject<HTMLAudioElement | null>;
  onClose: () => void;
  onEnded: () => void;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  queue: Track[];
  onRemoveFromQueue: (index: number) => void;
  onReorderQueue: (from: number, to: number) => void;
  onClearQueue: () => void;
  // Playback engine controls
  repeatMode: RepeatMode;
  onCycleRepeat: () => void;
  shuffleEnabled: boolean;
  onToggleShuffle: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
  muted: boolean;
  onToggleMute: () => void;
  playbackRate: number;
  onCyclePlaybackRate: () => void;
  upNextTrack: Track | null;
  isQueueOpen: boolean;
  onSetQueueOpen: (v: boolean) => void;
  // Restore props forwarded to Player
  restoreTime?: number;
  startPaused?: boolean;
  onRestored?: () => void;
  // Queue UX enhancements
  onBrowseLibrary?: () => void;
  onAddToQueue?: (track: Track) => void;
  /** Playback context set by the last explicit user play action — drives the source label. */
  playbackContext?: PlaybackContext | null;
};

function getNowPlayingRoot(): HTMLElement {
  const existing = document.getElementById('now-playing-root');
  if (existing) return existing;

  const root = document.createElement('div');
  root.id = 'now-playing-root';
  document.body.appendChild(root);
  return root;
}

// --- Icons ---

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function QueueIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M3 12h15M3 18h12" />
    </svg>
  );
}

function PrevIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6 18l8.5-6L6 6v12zm8.5-6v6H17V6h-2.5v6z" />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="9" cy="7" r="1.5" /><circle cx="15" cy="7" r="1.5" />
      <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="17" r="1.5" /><circle cx="15" cy="17" r="1.5" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function RepeatIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M17 1l4 4-4 4" />
      <path d="M3 11V9a4 4 0 014-4h14" />
      <path d="M7 23l-4-4 4-4" />
      <path d="M21 13v2a4 4 0 01-4 4H3" />
    </svg>
  );
}

function ShuffleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M16 3h5v5" />
      <path d="M4 20L21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

function VolumeIcon({ muted, volume }: { muted: boolean; volume: number }) {
  if (muted || volume === 0) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M23 9l-6 6M17 9l6 6" />
      </svg>
    );
  }
  if (volume < 0.5) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M11 5L6 9H2v6h4l5 4V5z" />
        <path d="M15.54 8.46a5 5 0 010 7.07" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M19.07 4.93a10 10 0 010 14.14" />
      <path d="M15.54 8.46a5 5 0 010 7.07" />
    </svg>
  );
}

// --- Repeat button with optional "1" badge ---

function RepeatButton({
  repeatMode,
  onCycleRepeat,
}: {
  repeatMode: RepeatMode;
  onCycleRepeat: () => void;
}) {
  const isActive = repeatMode !== 'off';
  const label =
    repeatMode === 'off' ? 'Repeat: off' : repeatMode === 'all' ? 'Repeat: all' : 'Repeat: one';

  return (
    <button
      type="button"
      className={`iconButton nowPlayingRepeatBtn${isActive ? ' iconButtonActive' : ''}`}
      onClick={onCycleRepeat}
      aria-label={label}
      title={label}
    >
      <RepeatIcon />
      {repeatMode === 'one' ? (
        <span className="repeatOneBadge" aria-hidden="true">1</span>
      ) : null}
    </button>
  );
}

export default function NowPlayingBar({
  track,
  playKey,
  audioRef,
  onClose,
  onEnded,
  onPrevTrack,
  onNextTrack,
  queue,
  onRemoveFromQueue,
  onReorderQueue,
  onClearQueue,
  repeatMode,
  onCycleRepeat,
  shuffleEnabled,
  onToggleShuffle,
  volume,
  onVolumeChange,
  muted,
  onToggleMute,
  playbackRate,
  onCyclePlaybackRate,
  upNextTrack,
  isQueueOpen,
  onSetQueueOpen,
  restoreTime,
  startPaused,
  onRestored,
  onBrowseLibrary,
  onAddToQueue,
  playbackContext,
}: NowPlayingBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isDragOverPanel, setIsDragOverPanel] = useState(false);

  const audioUrl = audioUrlFromTrack(track);
  const thumbnailUrl = thumbnailUrlFromTrack(track);

  // Observe the entire portal root so --now-playing-bar-height accounts for the queue panel too
  useEffect(() => {
    const root = getNowPlayingRoot();

    const syncHeight = (): void => {
      document.documentElement.style.setProperty('--now-playing-bar-height', `${root.offsetHeight}px`);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(root);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--now-playing-bar-height');
    };
  }, [track.id, audioUrl]);

  if (!audioUrl) return null;

  // --- Drag-and-drop handlers for queue reordering ---

  function handleDragStart(e: React.DragEvent, index: number): void {
    e.dataTransfer.effectAllowed = 'move';
    setDragIndex(index);
  }

  function handleDragOver(e: React.DragEvent, index: number): void {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (index !== dragOverIndex) setDragOverIndex(index);
  }

  function handleDrop(e: React.DragEvent, index: number): void {
    e.preventDefault();
    if (dragIndex !== null && dragIndex !== index) {
      onReorderQueue(dragIndex, index);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragEnd(): void {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  function handleDragLeave(): void {
    setDragOverIndex(null);
  }

  // --- Drag-and-drop: library track → queue panel ---

  function handlePanelDragOver(e: React.DragEvent): void {
    if (e.dataTransfer.types.includes('application/x-localflow-track')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsDragOverPanel(true);
    }
  }

  function handlePanelDragLeave(e: React.DragEvent): void {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsDragOverPanel(false);
    }
  }

  function handlePanelDrop(e: React.DragEvent): void {
    e.preventDefault();
    setIsDragOverPanel(false);
    try {
      const data = e.dataTransfer.getData('application/x-localflow-track');
      if (data) {
        const dropped = JSON.parse(data) as Track;
        onAddToQueue?.(dropped);
      }
    } catch {
      // Ignore malformed drag data
    }
  }

  // Format playback rate as "1×", "1.25×", etc.
  const rateLabel = playbackRate === 1 ? '1×' : `${playbackRate}×`;

  // Source label: shown for named contexts (user playlists, recently played)
  // All Songs and search are hidden to avoid visual noise
  const sourceLabel: string | null = (() => {
    const src = playbackContext?.source;
    if (!src) return null;
    if (src.type === 'user_playlist') return `From: ${src.playlistName}`;
    if (src.type === 'recently_played') return 'From: Recently Played';
    return null;
  })();

  const volumePct = muted ? 0 : volume * 100;

  return createPortal(
    <div className={`nowPlayingShell${isQueueOpen ? ' nowPlayingShellQueueOpen' : ''}`}>
      {isQueueOpen ? (
        <div
          className={`queuePanel${isDragOverPanel ? ' queuePanelDropTarget' : ''}`}
          role="region"
          aria-label="Playback queue"
          onDragOver={handlePanelDragOver}
          onDragLeave={handlePanelDragLeave}
          onDrop={handlePanelDrop}
        >
          <div className="queuePanelInner">
            <div className="queuePanelHeader">
              <span className="queuePanelTitle">
                {queue.length > 0 ? `Up next · ${queue.length}` : 'Queue'}
              </span>
              {queue.length > 0 ? (
                <button
                  type="button"
                  className="queuePanelClear"
                  onClick={onClearQueue}
                  aria-label="Clear queue"
                >
                  Clear
                </button>
              ) : null}
            </div>

            {queue.length > 0 ? (
              <div className="queuePanelList">
                {queue.map((t, i) => {
                  const thumb = thumbnailUrlFromTrack(t);
                  const durationText = formatDurationSeconds(t.duration);
                  const isDragging = dragIndex === i;
                  const isOver = dragOverIndex === i && dragIndex !== i;

                  return (
                    <div
                      key={`${t.id}-${i}`}
                      className={`queueItem${isDragging ? ' queueItemDragging' : ''}${isOver ? ' queueItemOver' : ''}`}
                      draggable
                      onDragStart={e => handleDragStart(e, i)}
                      onDragOver={e => handleDragOver(e, i)}
                      onDrop={e => handleDrop(e, i)}
                      onDragEnd={handleDragEnd}
                      onDragLeave={handleDragLeave}
                    >
                      <div className="queueItemIndex" aria-hidden="true">
                        <span className="queueItemIndexNum">{i + 1}</span>
                        <span className="queueItemDragHandle">
                          <DragHandleIcon />
                        </span>
                      </div>

                      <div className="queueItemThumb" aria-hidden="true">
                        {thumb ? <img src={thumb} alt="" /> : null}
                      </div>

                      <div className="queueItemInfo">
                        <div className="queueItemTitle">{t.title}</div>
                        <div className="queueItemArtist">{t.artist}</div>
                      </div>

                      {durationText ? (
                        <span className="queueItemDuration">{durationText}</span>
                      ) : (
                        <span className="queueItemDuration" aria-hidden="true" />
                      )}

                      <button
                        type="button"
                        className="iconButton queueItemRemove"
                        aria-label={`Remove ${t.title} from queue`}
                        onClick={() => onRemoveFromQueue(i)}
                      >
                        <RemoveIcon />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="queuePanelEmpty">
                Nothing queued yet.
                {onBrowseLibrary ? (
                  <>
                    {' '}
                    <button
                      type="button"
                      className="queuePanelBrowseLink"
                      onClick={() => {
                        onBrowseLibrary();
                        onSetQueueOpen(false);
                      }}
                    >
                      Browse library
                    </button>
                  </>
                ) : (
                  <> Use the queue button on any track in your library.</>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div ref={barRef} className="nowPlayingBar" role="region" aria-label="Now playing">
        <div className="nowPlayingInner">

          {/* Track metadata + up next */}
          <div className="nowPlayingMeta">
            <div className="nowPlayingThumb" aria-hidden="true">
              {thumbnailUrl ? <img src={thumbnailUrl} alt="" /> : null}
            </div>
            <div className="nowPlayingText">
              <div className="nowPlayingTitle">{track.title}</div>
              <div className="artist">{track.artist}</div>
              {upNextTrack ? (
                <div className="upNextLine" title={`Up next: ${upNextTrack.artist} — ${upNextTrack.title}`}>
                  Up next: {upNextTrack.artist} — {upNextTrack.title}
                </div>
              ) : null}
              {sourceLabel ? (
                <div className="playbackSourceLabel" title={sourceLabel}>
                  {sourceLabel}
                </div>
              ) : null}
            </div>
          </div>

          {/* Player controls (prev / play-pause-seek / next) */}
          <div className="nowPlayingControls">
            <div className="nowPlayingPlayerRow">
              <button
                type="button"
                className="iconButton playerNavBtn"
                onClick={onPrevTrack}
                aria-label="Previous track"
                title="Previous (Shift+←)"
              >
                <PrevIcon />
              </button>

              <div className="nowPlayingPlayerWrap">
                <Player
                  audioUrl={audioUrl}
                  audioRef={audioRef}
                  onEnded={onEnded}
                  playKey={playKey}
                  startPaused={startPaused}
                  restoreTime={restoreTime}
                  onRestored={onRestored}
                />
              </div>

              <button
                type="button"
                className="iconButton playerNavBtn"
                onClick={onNextTrack}
                aria-label="Next track"
                title="Next (Shift+→)"
              >
                <NextIcon />
              </button>
            </div>
          </div>

          {/* Secondary controls: shuffle, repeat, speed, volume, queue, close */}
          <div className="nowPlayingActions">
            <button
              type="button"
              className={`iconButton nowPlayingShuffleBtn${shuffleEnabled ? ' iconButtonActive' : ''}`}
              onClick={onToggleShuffle}
              aria-label={shuffleEnabled ? 'Shuffle: on' : 'Shuffle: off'}
              aria-pressed={shuffleEnabled}
              title="Shuffle (S)"
            >
              <ShuffleIcon />
            </button>

            <RepeatButton repeatMode={repeatMode} onCycleRepeat={onCycleRepeat} />

            <button
              type="button"
              className={`nowPlayingSpeedBtn${playbackRate !== 1 ? ' nowPlayingSpeedBtnActive' : ''}`}
              onClick={onCyclePlaybackRate}
              aria-label={`Playback speed: ${rateLabel}`}
              title="Cycle speed"
            >
              {rateLabel}
            </button>

            {/* Volume: icon (mute toggle) + slider */}
            <div className="nowPlayingVolumeControl">
              <button
                type="button"
                className={`iconButton nowPlayingVolumeBtn${muted || volume === 0 ? ' iconButtonActive' : ''}`}
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute (M)' : 'Mute (M)'}
                title={muted ? 'Unmute (M)' : 'Mute (M)'}
              >
                <VolumeIcon muted={muted} volume={volume} />
              </button>
              <input
                type="range"
                className="nowPlayingVolumeSlider"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={e => onVolumeChange(Number(e.target.value))}
                aria-label="Volume"
                style={{ '--vol-pct': `${volumePct}%` } as CSSProperties}
              />
            </div>

            <button
              type="button"
              className={`iconButton nowPlayingQueueBtn${isQueueOpen ? ' iconButtonActive' : ''}`}
              onClick={() => onSetQueueOpen(!isQueueOpen)}
              aria-label={isQueueOpen ? 'Close queue' : 'Open queue'}
              aria-pressed={isQueueOpen}
              title={queue.length > 0 ? `Queue (${queue.length}) — Q` : 'Queue (Q)'}
            >
              <QueueIcon />
              {queue.length > 0 ? (
                <span className="queueBadge" aria-hidden="true">{queue.length}</span>
              ) : null}
            </button>

            <button className="iconButton nowPlayingClose" type="button" onClick={onClose} aria-label="Close player">
              <CloseIcon />
            </button>
          </div>
        </div>
      </div>
    </div>,
    getNowPlayingRoot(),
  );
}
