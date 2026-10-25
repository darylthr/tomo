import type { ReaderMode } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import { Segmented } from '../../shared/ui/Segmented';
import styles from './ReaderPage.module.css';
import { useReader } from './readerStore';

type Props = {
  titleName: string;
  chapterName: string;
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

/** Reader controls: back, chapter name, page scrubber, chapter buttons, mode, brightness and warmth. */
export function ReaderChrome({ titleName, chapterName, onBack, onPrevChapter, onNextChapter, onModeChange }: Props) {
  const { index, pages, mode, chromeVisible, goTo } = useReader();
  const reader = useSettings((s) => s.settings.reader);
  const update = useSettings((s) => s.update);
  const rtl = mode === 'rtl';

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
      </header>

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
          <input
            className={styles.scrubber}
            type="range"
            min={1}
            max={Math.max(1, pages.length)}
            value={index + 1}
            dir={rtl ? 'rtl' : 'ltr'}
            aria-label="Page"
            aria-valuetext={`Page ${index + 1} of ${pages.length}`}
            onChange={(e) => goTo(Number(e.target.value) - 1)}
          />
          <span className={styles.counter}>
            {index + 1} / {pages.length}
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
        <div className={styles.modeRow}>
          <Segmented label="Reading mode" value={mode} onChange={onModeChange} options={MODES} />
        </div>
        <div className={styles.sliders}>
          <label>
            <span>Brightness</span>
            <input
              type="range"
              min={0.2}
              max={1}
              step={0.05}
              value={reader.brightness}
              onChange={(e) => update({ reader: { brightness: Number(e.target.value) } })}
            />
          </label>
          <label>
            <span>Warmth</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={reader.warm}
              onChange={(e) => update({ reader: { warm: Number(e.target.value) } })}
            />
          </label>
        </div>
      </footer>
    </div>
  );
}
