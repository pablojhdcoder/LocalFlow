import { useState } from 'react';
import type { Track } from '../api/client';
import type { Playlist } from '../playlists/playlistTypes';
import { PLAYLIST_ALL_SONGS } from '../playlists/playlistTypes';
import type { PlaybackContext } from '../playback/playbackContext';
import PlaylistSidebar from './PlaylistSidebar';
import PlaylistDetail from './PlaylistDetail';
import CreatePlaylistModal from './CreatePlaylistModal';

type LibraryProps = {
  tracks: Track[];
  loading: boolean;
  error: string | null;
  playlists: Playlist[];
  onDeleteTrack: (trackId: string) => Promise<void>;
  onPlayTrack: (track: Track, context?: PlaybackContext) => void;
  onPlayNext: (track: Track) => void;
  nowPlayingId: string | null;
  onAddToQueue: (track: Track) => void;
  queueTrackIds: Set<string>;
  recentlyPlayedVersion: number;
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onCreatePlaylist: (name: string) => Promise<Playlist | null>;
  onRenamePlaylist: (id: string, name: string) => void;
  onDeletePlaylist: (id: string) => void;
  onRemoveFromPlaylist: (playlistId: string, trackId: string) => Promise<void>;
  onReorderPlaylistTracks: (playlistId: string, trackIds: string[]) => Promise<void>;
  playlistTracksVersion: number;
};

export default function Library({
  tracks,
  loading,
  error,
  playlists,
  onDeleteTrack,
  onPlayTrack,
  onPlayNext,
  nowPlayingId,
  onAddToQueue,
  queueTrackIds,
  recentlyPlayedVersion,
  onAddToPlaylist,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
  onRemoveFromPlaylist,
  onReorderPlaylistTracks,
  playlistTracksVersion,
}: LibraryProps) {
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(PLAYLIST_ALL_SONGS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  // Track pending "create + add" — if set, after creating the playlist add this track
  const [pendingAddTrack, setPendingAddTrack] = useState<Track | null>(null);
  // Track pending rename
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId) ?? null;
  const userPlaylists = playlists.filter(p => p.kind === 'user');

  async function handleCreateConfirm(name: string) {
    setShowCreateModal(false);
    setRenameTarget(null);
    const pl = await onCreatePlaylist(name);
    if (pl) {
      setSelectedPlaylistId(pl.id);
      if (pendingAddTrack) {
        onAddToPlaylist(pl.id, pendingAddTrack);
        setPendingAddTrack(null);
      }
    }
  }

  async function handleRenameConfirm(name: string) {
    if (!renameTarget) return;
    onRenamePlaylist(renameTarget.id, name);
    setRenameTarget(null);
    setShowCreateModal(false);
  }

  function handleCreateAndAdd(track: Track) {
    setPendingAddTrack(track);
    setShowCreateModal(true);
  }

  function handleOpenRename(id: string, currentName: string) {
    setRenameTarget({ id, name: currentName });
    setShowCreateModal(true);
  }

  function handleDeletePlaylist(id: string) {
    const ok = window.confirm('Delete this playlist? Tracks in your library will not be affected.');
    if (!ok) return;
    onDeletePlaylist(id);
    if (selectedPlaylistId === id) setSelectedPlaylistId(PLAYLIST_ALL_SONGS);
  }

  const isRenaming = Boolean(renameTarget);

  return (
    <div className="page">
      <h1 className="pageTitle">Your Library</h1>

      {error ? <div className="errorBox">{error}</div> : null}

      <div className="libraryLayout">
        <PlaylistSidebar
          playlists={playlists}
          selectedId={selectedPlaylistId}
          onSelect={setSelectedPlaylistId}
          onCreatePlaylist={() => {
            setPendingAddTrack(null);
            setRenameTarget(null);
            setShowCreateModal(true);
          }}
          onRenamePlaylist={handleOpenRename}
          onDeletePlaylist={handleDeletePlaylist}
        />

        <div className="libraryDetailPane">
          <PlaylistDetail
            playlist={selectedPlaylist}
            libraryTracks={tracks}
            libraryLoading={loading}
            nowPlayingId={nowPlayingId}
            queueTrackIds={queueTrackIds}
            userPlaylists={userPlaylists}
            recentlyPlayedVersion={recentlyPlayedVersion}
            playlistTracksVersion={playlistTracksVersion}
            onPlayTrack={onPlayTrack}
            onPlayNext={onPlayNext}
            onAddToQueue={onAddToQueue}
            onDeleteTrack={onDeleteTrack}
            onAddToPlaylist={onAddToPlaylist}
            onCreateAndAdd={handleCreateAndAdd}
            onRemoveFromPlaylist={
              selectedPlaylist?.kind === 'user'
                ? (trackId) => onRemoveFromPlaylist(selectedPlaylistId, trackId)
                : undefined
            }
            onReorderTracks={
              selectedPlaylist?.kind === 'user'
                ? (trackIds) => onReorderPlaylistTracks(selectedPlaylistId, trackIds)
                : undefined
            }
          />
        </div>
      </div>

      {showCreateModal ? (
        <CreatePlaylistModal
          key={isRenaming ? `rename-${renameTarget?.id}` : 'create'}
          onConfirm={isRenaming ? handleRenameConfirm : handleCreateConfirm}
          onCancel={() => {
            setShowCreateModal(false);
            setRenameTarget(null);
            setPendingAddTrack(null);
          }}
          initialValue={renameTarget?.name ?? ''}
          title={isRenaming ? 'Rename playlist' : 'New playlist'}
        />
      ) : null}
    </div>
  );
}
