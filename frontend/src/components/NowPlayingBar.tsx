import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type RefObject } from 'react';
import type { Track } from '../api/client';
import { audioUrlFromTrack, thumbnailUrlFromTrack } from '../api/client';
import { formatDurationSeconds } from '../utils/format';
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
};

function getNowPlayingRoot(): HTMLElement {
  const existing = document.getElementById('now-playing-root');
  if (existing) return existing;

  const root = document.createElement('div');
  root.id = 'now-playing-root';
  document.body.appendChild(root);
  return root;
}

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
}: NowPlayingBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

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

  return createPortal(
    <div className={`nowPlayingShell${isQueueOpen ? ' nowPlayingShellQueueOpen' : ''}`}>
      {isQueueOpen ? (
        <div className="queuePanel" role="region" aria-label="Playback queue">
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
                Nothing queued yet. Use the queue button on any track in your library.
              </div>
            )}
          </div>
        </div>
      ) : null}

      <div ref={barRef} className="nowPlayingBar" role="region" aria-label="Now playing">
        <div className="nowPlayingInner">
          <div className="nowPlayingMeta">
            <div className="nowPlayingThumb" aria-hidden="true">
              {thumbnailUrl ? <img src={thumbnailUrl} alt="" /> : null}
            </div>
            <div className="nowPlayingText">
              <div className="nowPlayingTitle">{track.title}</div>
              <div className="artist">{track.artist}</div>
            </div>
          </div>

          <div className="nowPlayingControls">
            <div className="nowPlayingPlayerRow">
              <button
                type="button"
                className="iconButton playerNavBtn"
                onClick={onPrevTrack}
                aria-label="Previous track"
                title="Previous"
              >
                <PrevIcon />
              </button>

              <div className="nowPlayingPlayerWrap">
                <Player audioUrl={audioUrl} audioRef={audioRef} onEnded={onEnded} playKey={playKey} />
              </div>

              <button
                type="button"
                className="iconButton playerNavBtn"
                onClick={onNextTrack}
                aria-label="Next track"
                title="Next"
              >
                <NextIcon />
              </button>
            </div>
          </div>

          <div className="nowPlayingActions">
            <button
              type="button"
              className={`iconButton nowPlayingQueueBtn${isQueueOpen ? ' iconButtonActive' : ''}`}
              onClick={() => setIsQueueOpen(open => !open)}
              aria-label={isQueueOpen ? 'Close queue' : 'Open queue'}
              aria-pressed={isQueueOpen}
              title={queue.length > 0 ? `Queue (${queue.length})` : 'Queue'}
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
