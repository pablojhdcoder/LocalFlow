import { useCallback, useEffect, useState } from 'react';
import {
  addTrackToPlaylist,
  createPlaylist as apiCreatePlaylist,
  deletePlaylist as apiDeletePlaylist,
  getPlaylists,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
  renamePlaylist as apiRenamePlaylist,
  ApiClientError,
} from '../api/client';
import type { Playlist } from './playlistTypes';

type UsePlaylists = {
  playlists: Playlist[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  createPlaylist: (name: string) => Promise<Playlist | null>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addTrack: (playlistId: string, trackId: string) => Promise<{ alreadyExists: boolean }>;
  removeTrack: (playlistId: string, trackId: string) => Promise<void>;
  reorderTracks: (playlistId: string, trackIds: string[]) => Promise<void>;
};

export function usePlaylists(): UsePlaylists {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPlaylists();
      setPlaylists(data.playlists ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playlists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createPlaylist(name: string): Promise<Playlist | null> {
    try {
      const data = await apiCreatePlaylist(name);
      await reload();
      return data.playlist;
    } catch {
      return null;
    }
  }

  async function renamePlaylist(id: string, name: string): Promise<void> {
    await apiRenamePlaylist(id, name);
    await reload();
  }

  async function deletePlaylist(id: string): Promise<void> {
    await apiDeletePlaylist(id);
    await reload();
  }

  async function addTrack(
    playlistId: string,
    trackId: string,
  ): Promise<{ alreadyExists: boolean }> {
    try {
      await addTrackToPlaylist(playlistId, trackId);
      await reload();
      return { alreadyExists: false };
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 409) {
        return { alreadyExists: true };
      }
      throw err;
    }
  }

  async function removeTrack(playlistId: string, trackId: string): Promise<void> {
    await removeTrackFromPlaylist(playlistId, trackId);
    await reload();
  }

  async function reorderTracks(playlistId: string, trackIds: string[]): Promise<void> {
    try {
      await reorderPlaylistTracks(playlistId, trackIds);
    } catch (err) {
      await reload();
      throw err;
    }
  }

  return {
    playlists,
    loading,
    error,
    reload,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    addTrack,
    removeTrack,
    reorderTracks,
  };
}
