export type LocalflowTheme = 'dark' | 'light';

export type LocalflowSettingsV1 = {
  theme: LocalflowTheme;
};

export const LOCALFLOW_SETTINGS_KEY = 'localflow_settings_v1';

export function getDefaultLocalflowSettings(): LocalflowSettingsV1 {
  return {
    theme: 'dark',
  };
}

function isLocalflowSettingsV1(value: unknown): value is LocalflowSettingsV1 {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return v.theme === 'dark' || v.theme === 'light';
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function readLocalflowSettings(): LocalflowSettingsV1 {
  const defaults = getDefaultLocalflowSettings();
  try {
    const raw = window.localStorage.getItem(LOCALFLOW_SETTINGS_KEY);
    if (!raw) return defaults;

    const parsed = safeParseJson(raw);
    if (!isLocalflowSettingsV1(parsed)) return defaults;
    return parsed;
  } catch {
    return defaults;
  }
}

export function writeLocalflowSettings(next: LocalflowSettingsV1): void {
  try {
    window.localStorage.setItem(LOCALFLOW_SETTINGS_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors.
  }
}

export function applyLocalflowDocumentSettings(settings: LocalflowSettingsV1): void {
  try {
    document.documentElement.lang = 'en';
    document.documentElement.dataset.theme = settings.theme;
  } catch {
    // Ignore document errors.
  }
}
