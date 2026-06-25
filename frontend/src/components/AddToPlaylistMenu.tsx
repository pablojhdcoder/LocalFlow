import { useEffect, useRef, useState } from 'react';
import type { Track } from '../api/client';
import type { Playlist } from '../playlists/playlistTypes';

type AddToPlaylistMenuProps = {
  track: Track;
  userPlaylists: Playlist[];
  onAddToPlaylist: (playlistId: string, track: Track) => void;
  onCreateAndAdd: (track: Track) => void;
};

function AddIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function ListMusicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M3 6h18M3 12h12M3 18h8" />
      <circle cx="19" cy="15" r="3" />
      <path d="M22 9v6" />
    </svg>
  );
}

export default function AddToPlaylistMenu({
  track,
  userPlaylists,
  onAddToPlaylist,
  onCreateAndAdd,
}: AddToPlaylistMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="addToPlaylistWrap" ref={containerRef}>
      <button
        type="button"
        className="iconButton"
        aria-label="Add to playlist"
        title="Add to playlist"
        onClick={e => {
          e.stopPropagation();
          setOpen(v => !v);
        }}
      >
        <ListMusicIcon />
      </button>

      {open ? (
        <div className="addToPlaylistDropdown" onClick={e => e.stopPropagation()}>
          <div className="addToPlaylistTitle">Add to playlist</div>
          {userPlaylists.length === 0 ? (
            <div className="addToPlaylistEmpty">No playlists yet</div>
          ) : (
            <ul className="addToPlaylistList">
              {userPlaylists.map(pl => (
                <li key={pl.id}>
                  <button
                    type="button"
                    className="addToPlaylistItem"
                    onClick={() => {
                      onAddToPlaylist(pl.id, track);
                      setOpen(false);
                    }}
                  >
                    {pl.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="addToPlaylistCreate"
            onClick={() => {
              onCreateAndAdd(track);
              setOpen(false);
            }}
          >
            <AddIcon />
            <span>Create new playlist…</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
