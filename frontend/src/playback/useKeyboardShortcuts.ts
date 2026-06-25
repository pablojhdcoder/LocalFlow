import { useEffect, type RefObject } from 'react';

type KeyboardShortcutsOptions = {
  audioRef: RefObject<HTMLAudioElement | null>;
  /** Whether a track is currently loaded — prevents shortcuts from firing on an empty player */
  hasTrack: boolean;
  onPrevTrack: () => void;
  onNextTrack: () => void;
  onCycleRepeat: () => void;
  onToggleShuffle: () => void;
  onToggleQueue: () => void;
  onToggleMute: () => void;
};

function isTypingTarget(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return true;
  if (target.isContentEditable) return true;
  return false;
}

/**
 * Global keyboard shortcuts for playback control.
 * Shortcuts are suppressed when the user is typing in a form element.
 *
 * | Key              | Action                   |
 * |------------------|--------------------------|
 * | Space            | Play / Pause             |
 * | ArrowLeft        | Seek −5 s                |
 * | ArrowRight       | Seek +5 s                |
 * | Shift+ArrowLeft  | Previous track           |
 * | Shift+ArrowRight | Next track               |
 * | R                | Cycle repeat mode        |
 * | S                | Toggle shuffle           |
 * | Q                | Toggle queue panel       |
 * | M                | Toggle mute              |
 */
export function useKeyboardShortcuts({
  audioRef,
  hasTrack,
  onPrevTrack,
  onNextTrack,
  onCycleRepeat,
  onToggleShuffle,
  onToggleQueue,
  onToggleMute,
}: KeyboardShortcutsOptions): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (isTypingTarget(e)) return;

      const audio = audioRef.current;

      switch (e.code) {
        case 'Space':
          if (!hasTrack || !audio) return;
          e.preventDefault();
          if (audio.paused) void audio.play().catch(() => {});
          else audio.pause();
          break;

        case 'ArrowLeft':
          if (!hasTrack || !audio) return;
          e.preventDefault();
          if (e.shiftKey) onPrevTrack();
          else audio.currentTime = Math.max(0, audio.currentTime - 5);
          break;

        case 'ArrowRight':
          if (!hasTrack || !audio) return;
          e.preventDefault();
          if (e.shiftKey) onNextTrack();
          else audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
          break;

        case 'KeyR':
          onCycleRepeat();
          break;

        case 'KeyS':
          onToggleShuffle();
          break;

        case 'KeyQ':
          if (hasTrack) onToggleQueue();
          break;

        case 'KeyM':
          if (hasTrack) onToggleMute();
          break;

        default:
          break;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioRef, hasTrack, onPrevTrack, onNextTrack, onCycleRepeat, onToggleShuffle, onToggleQueue, onToggleMute]);
}
