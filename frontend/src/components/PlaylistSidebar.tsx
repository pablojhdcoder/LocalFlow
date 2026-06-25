import { useState } from 'react';
import type { Playlist } from '../playlists/playlistTypes';
import { PLAYLIST_ALL_SONGS } from '../playlists/playlistTypes';

type PlaylistSidebarProps = {
  playlists: Playlist[];
  selectedId: string;
  onSelect: (id: string) => void;
  onCreatePlaylist: () => void;
  onRenamePlaylist: (id: string, currentName: string) => void;
  onDeletePlaylist: (id: string) => void;
};

function MusicNoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M9 19c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3zm10-3c-1.7 0-3-1.3-3-3s1.3-3 3-3 3 1.3 3 3-1.3 3-3 3zm1-11L9 7v2l11-2V5z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

type PlaylistMenuProps = {
  playlist: Playlist;
  onRename: () => void;
  onDelete: () => void;
};

function PlaylistMenu({ playlist, onRename, onDelete }: PlaylistMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="playlistMenuWrap" onClick={e => e.stopPropagation()}>
      <button
        type="button"
        className="playlistMenuBtn"
        aria-label={`Options for ${playlist.name}`}
        onClick={() => setOpen(v => !v)}
      >
        <DotsIcon />
      </button>
      {open ? (
        <>
          <div className="playlistMenuOverlay" onClick={() => setOpen(false)} />
          <div className="playlistMenuDropdown">
            <button
              type="button"
              className="playlistMenuItem"
              onClick={() => { setOpen(false); onRename(); }}
            >
              Rename
            </button>
            <button
              type="button"
              className="playlistMenuItem playlistMenuItemDanger"
              onClick={() => { setOpen(false); onDelete(); }}
            >
              Delete playlist
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export default function PlaylistSidebar({
  playlists,
  selectedId,
  onSelect,
  onCreatePlaylist,
  onRenamePlaylist,
  onDeletePlaylist,
}: PlaylistSidebarProps) {
  const systemPlaylists = playlists.filter(p => p.kind === 'system');
  const userPlaylists = playlists.filter(p => p.kind === 'user');

  return (
    <nav className="playlistSidebar" aria-label="Playlists">
      <ul className="playlistNavList">
        {systemPlaylists.map(pl => (
          <li key={pl.id}>
            <button
              type="button"
              className={`playlistNavItem${selectedId === pl.id ? ' playlistNavItemActive' : ''}`}
              onClick={() => onSelect(pl.id)}
            >
              <span className="playlistNavIcon" aria-hidden="true">
                {pl.id === PLAYLIST_ALL_SONGS ? <MusicNoteIcon /> : <ClockIcon />}
              </span>
              <span className="playlistNavName">{pl.name}</span>
              <span className="playlistNavCount">{pl.trackCount}</span>
            </button>
          </li>
        ))}
      </ul>

      {userPlaylists.length > 0 ? (
        <>
          <div className="playlistNavDivider" />
          <ul className="playlistNavList">
            {userPlaylists.map(pl => (
              <li key={pl.id} className="playlistNavItemRow">
                <button
                  type="button"
                  className={`playlistNavItem${selectedId === pl.id ? ' playlistNavItemActive' : ''}`}
                  onClick={() => onSelect(pl.id)}
                >
                  <span className="playlistNavName">{pl.name}</span>
                  <span className="playlistNavCount">{pl.trackCount}</span>
                </button>
                <PlaylistMenu
                  playlist={pl}
                  onRename={() => onRenamePlaylist(pl.id, pl.name)}
                  onDelete={() => onDeletePlaylist(pl.id)}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <div className="playlistNavDivider" />
      <button type="button" className="createPlaylistBtn" onClick={onCreatePlaylist}>
        <PlusIcon />
        <span>New playlist</span>
      </button>
    </nav>
  );
}
