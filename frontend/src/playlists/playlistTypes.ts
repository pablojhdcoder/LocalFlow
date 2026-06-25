export type PlaylistKind = 'system' | 'user';

export type Playlist = {
  id: string;
  name: string;
  kind: PlaylistKind;
  systemKey?: 'all_songs' | 'recently_played';
  trackCount: number;
  createdAt?: number;
  updatedAt?: number;
};

export const PLAYLIST_ALL_SONGS = 'system:all_songs';
export const PLAYLIST_RECENTLY_PLAYED = 'system:recently_played';
