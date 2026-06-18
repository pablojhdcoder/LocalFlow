import { useEffect, useState } from 'react';

type SearchBarProps = {
  onSearch: (q: string) => void;
  onClear: () => void;
  canClear?: boolean;
  isLoading?: boolean;
  initialValue?: string;
};

const MIN_QUERY_LENGTH = 3;

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export default function SearchBar({ onSearch, onClear, canClear = false, isLoading, initialValue }: SearchBarProps) {
  const [value, setValue] = useState(initialValue || '');

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  const queryLength = value.trim().length;
  const showClear = canClear || queryLength > 0;

  function handleClear(): void {
    setValue('');
    onClear();
  }

  return (
    <form
      className="searchRow"
      onSubmit={e => {
        e.preventDefault();
        onSearch(value);
      }}
    >
      <div className="searchField">
        <span className="searchFieldIcon">
          <SearchIcon />
        </span>
        <input
          className={`searchInput${showClear ? ' searchInputWithClear' : ''}`}
          value={value}
          placeholder="What do you want to listen to?"
          onChange={e => setValue(e.target.value)}
          disabled={isLoading}
          inputMode="search"
        />
        {showClear ? (
          <button
            type="button"
            className="searchClearBtn"
            onClick={handleClear}
            disabled={isLoading}
            aria-label="Clear search"
          >
            <ClearIcon />
          </button>
        ) : null}
      </div>
      <button className="button buttonPrimary" type="submit" disabled={isLoading || queryLength < MIN_QUERY_LENGTH}>
        {isLoading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}
