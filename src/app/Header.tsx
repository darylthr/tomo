import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconBook, IconClose, IconSearch, IconSettings } from '../shared/ui/icons';
import { useUi } from '../shared/ui/uiStore';
import styles from './Header.module.css';

const SEARCH_DEBOUNCE_MS = 280;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/** Floating header: settings on the left, brand centered, search icon that expands into a field. */
export function Header() {
  const navigate = useNavigate();
  const openSettings = useUi((s) => s.openSettings);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const openSearch = () => {
    setOpen(true);
    inputRef.current?.focus({ preventScroll: true });
  };

  const closeSearch = () => {
    clearTimeout(timer.current);
    setOpen(false);
    setQuery('');
    buttonRef.current?.focus({ preventScroll: true });
  };

  const onChange = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const q = value.trim();
      navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search', { replace: true });
    }, SEARCH_DEBOUNCE_MS);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !isTyping(e.target)) {
        e.preventDefault();
        setOpen(true);
        inputRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <header className={`${styles.header} ${open ? styles.open : ''}`} data-search-open={open}>
      <button type="button" className={`${styles.iconBtn} ${styles.settings}`} aria-label="Settings" onClick={openSettings}>
        <IconSettings />
      </button>
      <div className={styles.brand}>
        <IconBook />
        <span>Tomo</span>
      </div>
      <button
        ref={buttonRef}
        type="button"
        className={`${styles.iconBtn} ${styles.searchBtn}`}
        aria-label="Search all sources"
        aria-expanded={open}
        onClick={openSearch}
      >
        <IconSearch />
      </button>
      <div className={styles.search} role="search">
        <IconSearch />
        <input
          ref={inputRef}
          className={styles.input}
          type="search"
          placeholder="Search all sources"
          aria-label="Search all sources"
          autoComplete="off"
          enterKeyHint="search"
          tabIndex={open ? 0 : -1}
          value={query}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              closeSearch();
            }
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <button
          type="button"
          className={styles.iconBtn}
          aria-label="Close search"
          tabIndex={open ? 0 : -1}
          onClick={closeSearch}
        >
          <IconClose />
        </button>
      </div>
    </header>
  );
}
