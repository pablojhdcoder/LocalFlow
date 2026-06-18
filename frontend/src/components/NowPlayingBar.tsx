import { createPortal } from 'react-dom';
import { useEffect, useRef, type RefObject } from 'react';
import type { Track } from '../api/client';
import { audioUrlFromTrack, thumbnailUrlFromTrack } from '../api/client';
import Player from './Player';

type NowPlayingBarProps = {
  track: Track;
  audioRef: RefObject<HTMLAudioElement | null>;
  onClose: () => void;
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

export default function NowPlayingBar({ track, audioRef, onClose }: NowPlayingBarProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const audioUrl = audioUrlFromTrack(track);
  const thumbnailUrl = thumbnailUrlFromTrack(track);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const syncHeight = (): void => {
      document.documentElement.style.setProperty('--now-playing-bar-height', `${bar.offsetHeight}px`);
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(bar);

    return () => {
      observer.disconnect();
      document.documentElement.style.removeProperty('--now-playing-bar-height');
    };
  }, [track.id, audioUrl]);

  if (!audioUrl) return null;

  return createPortal(
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
          <Player audioUrl={audioUrl} audioRef={audioRef} />
        </div>

        <button className="iconButton nowPlayingClose" type="button" onClick={onClose} aria-label="Close player">
          <CloseIcon />
        </button>
      </div>
    </div>,
    getNowPlayingRoot(),
  );
}
