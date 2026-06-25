const LIBRARY_SORT_KEY = 'localflow_library_v1';

export type LibrarySortKey =
  | 'date-desc'
  | 'title-asc'
  | 'artist-asc'
  | 'duration-asc'
  | 'duration-desc';

const VALID_SORT_KEYS: LibrarySortKey[] = [
  'date-desc',
  'title-asc',
  'artist-asc',
  'duration-asc',
  'duration-desc',
];

export function readLibrarySort(): LibrarySortKey {
  try {
    const raw = localStorage.getItem(LIBRARY_SORT_KEY);
    if (raw && VALID_SORT_KEYS.includes(raw as LibrarySortKey)) {
      return raw as LibrarySortKey;
    }
  } catch {
    // Ignore
  }
  return 'date-desc';
}

export function writeLibrarySort(sort: LibrarySortKey): void {
  try {
    localStorage.setItem(LIBRARY_SORT_KEY, sort);
  } catch {
    // Ignore
  }
}
