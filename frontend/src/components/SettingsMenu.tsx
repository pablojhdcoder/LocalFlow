import { useEffect, useRef, useState } from 'react';
import type { LocalflowSettingsV1 } from '../settings/localflowSettings';

type SettingsMenuProps = {
  settings: LocalflowSettingsV1;
  onApply: (next: LocalflowSettingsV1) => void;
};

export default function SettingsMenu({ settings, onApply }: SettingsMenuProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<LocalflowSettingsV1>(settings);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent): void {
      const el = wrapperRef.current;
      const target = e.target as Node | null;
      if (!el || !target || el.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') setOpen(false);
    }

    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function applyTheme(nextTheme: LocalflowSettingsV1['theme']): void {
    setDraft(prev => ({ ...prev, theme: nextTheme }));
    onApply({ ...settings, theme: nextTheme });
  }

  return (
    <div className="settingsWrapper" ref={wrapperRef}>
      <button
        type="button"
        className="settingsIconButton"
        aria-label="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.62l-1.92-3.32c-.11-.21-.36-.3-.59-.22l-2.39.96c-.5-.38-1.05-.69-1.64-.92l-.36-2.54A.493.493 0 0 0 13.87 1h-3.74c-.25 0-.46.18-.5.42l-.36 2.54c-.59.23-1.14.54-1.64.92l-2.39-.96c-.23-.09-.48 0-.59.22L1.73 7.46c-.11.21-.06.48.12.62l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L1.85 14.52a.532.532 0 0 0-.12.62l1.92 3.32c.11.21.36.3.59.22l2.39-.96c.5.38 1.05.69 1.64.92l.36 2.54c.04.24.25.42.5.42h3.74c.25 0 .46-.18.5-.42l.36-2.54c.59-.23 1.14-.54 1.64-.92l2.39.96c.23.09.48 0 .59-.22l1.92-3.32c.11-.21.06-.48-.12-.62l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"
            fill="currentColor"
          />
        </svg>
      </button>

      {open ? (
        <div className="settingsDropdown" role="menu" aria-label="Settings">
          <div className="settingsSectionTitle">Settings</div>

          <div className="settingsField">
            <div className="settingsLabel">Theme</div>
            <label className="themeSwitch">
              <input
                type="checkbox"
                checked={draft.theme === 'light'}
                onChange={e => applyTheme(e.target.checked ? 'light' : 'dark')}
              />
              <span className="themeSlider" aria-hidden="true" />
              <span className="themeSwitchLabels" aria-hidden="true">
                <span className="themeSwitchLabel">Dark</span>
                <span className="themeSwitchLabel">Light</span>
              </span>
            </label>
          </div>

          <div className="settingsActions">
            <button type="button" className="button" onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
