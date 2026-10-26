import { useState, type ReactNode } from 'react';
import type { ReaderMode } from '../../shared/model/types';
import type { BackgroundSettings, LibrarySettings, ReaderSettings, ThemeMode } from '../../shared/settings/schema';
import { useSettings } from '../../shared/settings/store';
import { meetsAA } from '../../shared/theme/contrast';
import { Page } from '../../shared/ui/Page';
import { Segmented } from '../../shared/ui/Segmented';
import { Switch } from '../../shared/ui/Switch';
import { clearBackgroundImage, saveBackgroundImage } from '../background/backgroundImage';
import { ServerSection } from '../server/ServerSection';
import styles from './Settings.module.css';

function Row({ label, stack, children }: { label: string; stack?: boolean; children: ReactNode }) {
  return (
    <div className={stack ? styles.stack : styles.row}>
      <span className={styles.label}>{label}</span>
      {children}
    </div>
  );
}

const LEVELS = [
  { value: '4', label: 'Low' },
  { value: '6', label: 'Mid' },
  { value: '9', label: 'High' },
];
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
const GRAIN = [
  { value: '2', label: 'Fine' },
  { value: '3', label: 'Mid' },
  { value: '4', label: 'Coarse' },
];

/** The Settings tab: server, library, reading, background and appearance. */
export function SettingsPage() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const [imageError, setImageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lib = (patch: Partial<LibrarySettings>) => update({ library: patch });
  const bg = (patch: Partial<BackgroundSettings>) => update({ background: patch });
  const { library, background, theme, reader } = settings;
  const lowContrast = theme.mode === 'custom' && !meetsAA(theme.ink, theme.bg);

  const onImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setImageError(null);
    try {
      await saveBackgroundImage(file);
    } catch (e) {
      setImageError(e instanceof Error ? e.message : "Couldn't read that image");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Settings">
      <div className={styles.sections}>
        <ServerSection />

        <section className={styles.section} aria-label="Library">
          <h3 className={styles.heading}>Library</h3>
          <Row label="Show titles as">
            <Segmented
              label="Show titles as"
              value={library.display}
              onChange={(display) => lib({ display })}
              options={[
                { value: 'books', label: 'Books' },
                { value: 'covers', label: 'Covers' },
              ]}
            />
          </Row>
          <Row label="Scrolling">
            <Segmented
              label="Scrolling"
              value={library.scroll}
              onChange={(scroll) => lib({ scroll })}
              options={[
                { value: 'horizontal', label: 'Horizontal' },
                { value: 'vertical', label: 'Vertical' },
              ]}
            />
          </Row>
          <Row label="Fade the shelf sides">
            <Switch label="Fade the shelf sides" checked={library.fadeSides} onChange={(fadeSides) => lib({ fadeSides })} />
          </Row>
          <Row label="Styled title logos">
            <Switch label="Styled title logos" checked={library.styledLogos} onChange={(styledLogos) => lib({ styledLogos })} />
          </Row>
          <Row label="3D detail">
            <Segmented
              label="3D detail"
              value={library.detail}
              onChange={(detail) => lib({ detail })}
              options={[
                { value: 'full', label: 'Full' },
                { value: 'lite', label: 'Lite' },
              ]}
            />
          </Row>
          <Row label="Mirror right-to-left manga">
            <Switch label="Mirror right-to-left manga" checked={library.mirrorRtl} onChange={(mirrorRtl) => lib({ mirrorRtl })} />
          </Row>
        </section>

        <section className={styles.section} aria-label="Reading">
          <h3 className={styles.heading}>Reading</h3>
          <Row label="Default reading mode" stack>
            <Segmented
              label="Default reading mode"
              value={reader.defaultMode}
              onChange={(defaultMode) => update({ reader: { defaultMode } })}
              options={MODES}
            />
          </Row>
          <Row label="Fit pages to">
            <Segmented label="Fit pages to" value={reader.fit} onChange={(fit) => update({ reader: { fit } })} options={FITS} />
          </Row>
        </section>

        <section className={styles.section} aria-label="Background">
          <h3 className={styles.heading}>Background</h3>
          <Row label="Dithered background">
            <Switch
              label="Dithered background"
              checked={background.enabled && background.imageKey !== null}
              disabled={background.imageKey === null}
              onChange={(enabled) => bg({ enabled })}
            />
          </Row>
          <Row label="Image">
            <span className={styles.imageActions}>
              {background.imageKey && (
                <button type="button" className={styles.ghost} onClick={() => void clearBackgroundImage()}>
                  Remove
                </button>
              )}
              <label className={styles.ghost} aria-busy={busy}>
                {busy ? 'Saving…' : 'Choose…'}
                <input
                  className={styles.file}
                  type="file"
                  accept="image/*"
                  aria-label="Choose image"
                  onChange={(e) => {
                    void onImage(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
            </span>
          </Row>
          {imageError && (
            <p className={styles.error} role="alert">
              {imageError}
            </p>
          )}
          <Row label="Color depth">
            <Segmented
              label="Color depth"
              value={String(background.levels)}
              onChange={(v) => bg({ levels: Number(v) as BackgroundSettings['levels'] })}
              options={LEVELS}
            />
          </Row>
          <Row label="Grain">
            <Segmented
              label="Grain"
              value={String(background.cell)}
              onChange={(v) => bg({ cell: Number(v) as BackgroundSettings['cell'] })}
              options={GRAIN}
            />
          </Row>
        </section>

        <section className={styles.section} aria-label="Appearance">
          <h3 className={styles.heading}>Appearance</h3>
          <Row label="Theme">
            <Segmented<ThemeMode>
              label="Theme"
              value={theme.mode}
              onChange={(mode) => update({ theme: { mode } })}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
                { value: 'custom', label: 'Custom' },
              ]}
            />
          </Row>
          {theme.mode === 'custom' && (
            <>
              {(['bg', 'ink', 'accent'] as const).map((key) => {
                const name = { bg: 'Background color', ink: 'Text color', accent: 'Accent color' }[key];
                return (
                  <Row key={key} label={name}>
                    <input
                      className={styles.color}
                      type="color"
                      aria-label={name}
                      value={theme[key]}
                      onChange={(e) => update({ theme: { [key]: e.target.value } })}
                    />
                  </Row>
                );
              })}
              {lowContrast && <p className={styles.warning}>Text may be hard to read on this background</p>}
            </>
          )}
        </section>
      </div>
    </Page>
  );
}
