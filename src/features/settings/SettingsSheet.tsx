import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { BackgroundSettings, LibrarySettings, ThemeMode } from '../../shared/settings/schema';
import { useSettings } from '../../shared/settings/store';
import { meetsAA } from '../../shared/theme/contrast';
import { IconClose } from '../../shared/ui/icons';
import { Segmented } from '../../shared/ui/Segmented';
import { Switch } from '../../shared/ui/Switch';
import { useUi } from '../../shared/ui/uiStore';
import { clearBackgroundImage, saveBackgroundImage } from '../background/backgroundImage';
import { ServerSection } from '../server/ServerSection';
import styles from './SettingsSheet.module.css';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
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
const GRAIN = [
  { value: '2', label: 'Fine' },
  { value: '3', label: 'Mid' },
  { value: '4', label: 'Coarse' },
];

export function SettingsSheet() {
  const open = useUi((s) => s.settingsOpen);
  const close = useUi((s) => s.closeSettings);
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const [imageError, setImageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocus.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>(`.${styles.close}`)?.focus({ preventScroll: true });
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocus.current?.focus({ preventScroll: true });
    }
  }, [open]);

  const lib = (patch: Partial<LibrarySettings>) => update({ library: patch });
  const bg = (patch: Partial<BackgroundSettings>) => update({ background: patch });
  const { library, background, theme } = settings;
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
    <dialog
      ref={dialogRef}
      className={styles.sheet}
      aria-labelledby={titleId}
      onClose={close}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.body}>
        <header className={styles.head}>
          <h2 id={titleId} className={styles.title}>
            Settings
          </h2>
          <button type="button" className={styles.close} aria-label="Close settings" onClick={close}>
            <IconClose />
          </button>
        </header>

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
    </dialog>
  );
}
