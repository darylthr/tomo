import { useEffect, useId, useState } from 'react';
import type { ReaderMode } from '../../shared/model/types';
import type { ReaderSettings } from '../../shared/settings/schema';
import { useSettings } from '../../shared/settings/store';
import { IconBookmark, IconSettings } from '../../shared/ui/icons';
import { Segmented } from '../../shared/ui/Segmented';
import { Switch } from '../../shared/ui/Switch';
import { TickSlider } from '../../shared/ui/TickSlider';
import styles from './ReaderPage.module.css';
import { useReader } from './readerStore';
import { wantsSpreads } from './spreads';
import { useViewport } from './useViewport';

type Props = {
  /** For per-title options (the cover in spreads). */
  titleId?: number;
  titleName: string;
  chapterName: string;
  /** The chapter's own bookmark (Suwayomi's isBookmarked). */
  bookmarked?: boolean;
  onBookmark?: (bookmarked: boolean) => void;
  onBack: () => void;
  onPrevChapter: (() => void) | null;
  onNextChapter: (() => void) | null;
  onModeChange: (mode: ReaderMode) => void;
};

const MODES: { value: ReaderMode; label: string }[] = [
  { value: 'rtl', label: 'Manga' },
  { value: 'ltr', label: 'Comic' },
  { value: 'webtoon', label: 'Webtoon' },
  { value: 'vertical', label: 'Vertical' },
];

const FITS: { value: ReaderSettings['fit']; label: string }[] = [
  { value: 'screen', label: 'Screen' },
  { value: 'width', label: 'Width' },
  { value: 'height', label: 'Height' },
];

const percent = (v: number) => `${Math.round(v * 100)}%`;

/**
 * Reader controls: back, the centred title and chapter, and reading options on top;
 * chapter buttons around a page slider (one line per page) at the bottom.
 */
export function ReaderChrome({ titleId, titleName, chapterName, bookmarked = false, onBookmark, onBack, onPrevChapter, onNextChapter, onModeChange }: Props) {
  const { index, view, layout, pages, mode, chromeVisible, goTo, openPageActions } = useReader();
  const viewport = useViewport();
  // Double pages only matter where they could show; the cover options only while they do.
  const canSpread = wantsSpreads('auto', viewport, mode);
  const spreadsShowing = layout.some((e) => e.length > 1);
  const reader = useSettings((s) => s.settings.reader);
  const update = useSettings((s) => s.update);
  const [optionsWanted, setOptions] = useState(false);
  const optionsOpen = optionsWanted && chromeVisible;
  const optionsId = useId();
  const rtl = mode === 'rtl';
  const paged = mode !== 'webtoon';

  // Escape closes the options first; the reader only leaves on the next Escape.
  useEffect(() => {
    if (!optionsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation();
      e.stopPropagation();
      setOptions(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [optionsOpen]);

  return (
    <div
      className={`${styles.chrome} ${chromeVisible ? '' : styles.hidden}`}
      ref={(el) => {
        // hidden controls leave the tab order and the accessibility tree
        if (el) el.inert = !chromeVisible;
      }}
    >
      <header className={styles.top}>
        <button type="button" className={styles.round} aria-label="Back" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m15 6-6 6 6 6" />
          </svg>
        </button>
        <div className={styles.titles}>
          <b>{titleName}</b>
          <span>{chapterName}</span>
        </div>
        <div className={styles.topActions}>
        {onBookmark && (
          <button
            type="button"
            className={styles.round}
            aria-label={bookmarked ? 'Remove chapter bookmark' : 'Bookmark chapter'}
            aria-pressed={bookmarked}
            data-active={bookmarked || undefined}
            onClick={() => onBookmark(!bookmarked)}
          >
            <IconBookmark filled={bookmarked} />
          </button>
        )}
        <button
          type="button"
          className={styles.round}
          aria-label="Reading options"
          aria-expanded={optionsOpen}
          aria-controls={optionsId}
          data-active={optionsOpen || undefined}
          onClick={() => setOptions((o) => !o)}
        >
          <IconSettings filled={optionsOpen} />
        </button>
        </div>
      </header>

      {optionsOpen && <div className={styles.optionsScrim} aria-hidden="true" onClick={() => setOptions(false)} />}
      <section
        id={optionsId}
        className={`${styles.options} ${optionsOpen ? styles.optionsOpen : ''}`}
        aria-label="Reading options"
        aria-hidden={!optionsOpen}
        ref={(el) => {
          if (el) el.inert = !optionsOpen;
        }}
      >
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>Mode</span>
          <Segmented label="Reading mode" value={mode} onChange={onModeChange} options={MODES} />
        </div>
        {paged && (
          <div className={styles.optionRow}>
            <span className={styles.optionLabel}>Fit</span>
            <Segmented label="Fit pages to" value={reader.fit} onChange={(fit) => update({ reader: { fit } })} options={FITS} />
          </div>
        )}
        {canSpread && (
          <div className={styles.optionRow}>
            <span className={styles.optionLabel}>Double pages</span>
            <Segmented
              label="Double pages"
              value={reader.spreads}
              onChange={(spreads) => update({ reader: { spreads } })}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </div>
        )}
        {spreadsShowing && titleId !== undefined && (
          <CoverOptions
            value={reader.coverAloneByTitle[String(titleId)] ?? reader.coverAlone}
            onChange={(alone) => update({ reader: { coverAloneByTitle: { ...reader.coverAloneByTitle, [String(titleId)]: alone } } })}
          />
        )}
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>This page</span>
          <button
            type="button"
            className={styles.optionButton}
            onClick={() => {
              setOptions(false);
              openPageActions(view[0] ?? index);
            }}
          >
            Save page
          </button>
        </div>
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>
            Brightness <b>{percent(reader.brightness)}</b>
          </span>
          <TickSlider
            label="Brightness"
            min={0.2}
            max={1}
            step={0.05}
            value={reader.brightness}
            valueText={percent}
            onChange={(brightness) => update({ reader: { brightness } })}
          />
        </div>
        <div className={styles.optionRow}>
          <span className={styles.optionLabel}>
            Warmth <b>{percent(reader.warm)}</b>
          </span>
          <TickSlider
            label="Warmth"
            min={0}
            max={1}
            step={0.05}
            value={reader.warm}
            valueText={percent}
            onChange={(warm) => update({ reader: { warm } })}
          />
        </div>
      </section>

      <footer className={styles.bottom}>
        <div className={styles.scrubRow}>
          <button
            type="button"
            className={styles.round}
            aria-label="Previous chapter"
            disabled={!onPrevChapter}
            onClick={() => onPrevChapter?.()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 11 12l7 6M7 6v12" />
            </svg>
          </button>
          <TickSlider
            className={styles.scrubber}
            label="Page"
            min={1}
            max={Math.max(1, pages.length)}
            value={index + 1}
            dir={rtl ? 'rtl' : 'ltr'}
            valueText={(v) => `Page ${v} of ${pages.length}`}
            onChange={(v) => goTo(v - 1)}
          />
          <span className={styles.counter}>
            {view.length > 1 ? `${view[0]! + 1}–${view[view.length - 1]! + 1}` : index + 1} / {pages.length}
          </span>
          <button
            type="button"
            className={styles.round}
            aria-label="Next chapter"
            disabled={!onNextChapter}
            onClick={() => onNextChapter?.()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 6 7 6-7 6M17 6v12" />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
}

/** For this title: whether page 1 stands alone, and a one-tap shift when pairs come out off by one. */
function CoverOptions({ value, onChange }: { value: boolean; onChange: (alone: boolean) => void }) {
  return (
    <div className={styles.optionRow}>
      <span className={styles.optionLabel}>First page is a cover</span>
      <span className={styles.coverOptions}>
        <button type="button" className={styles.optionButton} onClick={() => onChange(!value)}>
          Shift pages
        </button>
        <Switch label="First page is a cover" checked={value} onChange={onChange} />
      </span>
    </div>
  );
}
