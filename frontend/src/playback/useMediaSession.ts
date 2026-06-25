import { useEffect, type RefObject } from 'react';
import type { Track } from '../api/client';
import { thumbnailUrlFromTrack } from '../api/client';

type MediaSessionOptions = {
  track: Track | null;
  audioRef: RefObject<HTMLAudioElement | null>;
  onPrev: () => void;
  onNext: () => void;
};

/**
 * Integrates with the browser's Media Session API so OS media keys and
 * lock-screen controls work correctly.
 * Cleared when track becomes null (player closed).
 */
export function useMediaSession({ track, audioRef, onPrev, onNext }: MediaSessionOptions): void {
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (!track) {
      navigator.mediaSession.metadata = null;
      return;
    }

    const thumbnailUrl = thumbnailUrlFromTrack(track);

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist,
      artwork: thumbnailUrl
        ? [
            { src: thumbnailUrl, sizes: '96x96', type: 'image/jpeg' },
            { src: thumbnailUrl, sizes: '256x256', type: 'image/jpeg' },
          ]
        : [],
    });

    const audio = audioRef.current;

    navigator.mediaSession.setActionHandler('play', () => {
      void audio?.play().catch(() => {});
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio?.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', onPrev);
    navigator.mediaSession.setActionHandler('nexttrack', onNext);
    navigator.mediaSession.setActionHandler('seekbackward', details => {
      if (!audio) return;
      const offset = details.seekOffset ?? 5;
      audio.currentTime = Math.max(0, audio.currentTime - offset);
    });
    navigator.mediaSession.setActionHandler('seekforward', details => {
      if (!audio) return;
      const offset = details.seekOffset ?? 5;
      audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + offset);
    });

    return () => {
      navigator.mediaSession.metadata = null;
      // Clear action handlers to avoid stale callbacks
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('seekbackward', null);
      navigator.mediaSession.setActionHandler('seekforward', null);
    };
  }, [track, audioRef, onPrev, onNext]);
}
