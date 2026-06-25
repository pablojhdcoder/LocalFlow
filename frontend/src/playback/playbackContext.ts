import type { Track } from '../api/client';

/**
 * Identifies where playback was initiated from.
 * Determines which ordered track list drives prev/next navigation.
 */
export type PlaybackSource =
  | { type: 'all_songs' }
  | { type: 'recently_played' }
  | { type: 'user_playlist'; playlistId: string; playlistName: string }
  | { type: 'search' }
  | null;

/** Alias used by playbackStorage for serialisation. */
export type PlaybackContextSource = PlaybackSource;

/**
 * Playback context set when the user explicitly starts a track.
 * The engine uses `tracks` for sequential prev/next instead of falling back to
 * the full library, so "play from playlist" stays within that playlist.
 *
 * Context is NOT updated by autoplay advances — it only changes on explicit user action.
 * Context is NOT persisted across reloads (tracks would need to be re-fetched).
 */
export type PlaybackContext = {
  source: PlaybackSource;
  /**
   * Ordered, ready-to-play tracks in the current context.
   * Must contain only tracks with status === 'ready' and a valid audioUrl.
   */
  tracks: Track[];
};
