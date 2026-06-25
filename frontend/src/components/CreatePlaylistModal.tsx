import { useEffect, useRef, useState } from 'react';

type CreatePlaylistModalProps = {
  onConfirm: (name: string) => void;
  onCancel: () => void;
  initialValue?: string;
  title?: string;
};

export default function CreatePlaylistModal({
  onConfirm,
  onCancel,
  initialValue = '',
  title = 'New playlist',
}: CreatePlaylistModalProps) {
  const [name, setName] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 80) return;
    onConfirm(trimmed);
  }

  return (
    <div className="modalOverlay" onClick={onCancel}>
      <div
        className="modalBox"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modalTitle">{title}</div>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            className="modalInput"
            placeholder="Playlist name"
            value={name}
            maxLength={80}
            onChange={e => setName(e.target.value)}
          />
          <div className="modalActions">
            <button type="button" className="button" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="submit"
              className="button buttonPrimary"
              disabled={!name.trim() || name.trim().length > 80}
            >
              {title === 'Rename playlist' ? 'Rename' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
