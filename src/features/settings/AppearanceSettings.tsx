import { useState } from 'react';
import type { BackgroundSettings } from '../../shared/settings/schema';
import { useSettings } from '../../shared/settings/store';
import { Segmented } from '../../shared/ui/Segmented';
import { Switch } from '../../shared/ui/Switch';
import { clearBackgroundImage, saveBackgroundImage } from '../background/backgroundImage';
import { Card, Row, SettingsSubpage } from './parts';
import { ThemeGrid } from './ThemeGrid';
import styles from './Settings.module.css';

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

/** Settings → Appearance: the theme and the dithered background. */
export function AppearanceSettings() {
  const background = useSettings((s) => s.settings.background);
  const update = useSettings((s) => s.update);
  const [imageError, setImageError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The theme editor (the themes plan's Task 6) opens for this id.
  const [, setEditing] = useState<string | null>(null);

  const bg = (patch: Partial<BackgroundSettings>) => update({ background: patch });

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
    <SettingsSubpage title="Appearance">
      <Card label="Theme" heading>
        <ThemeGrid onEdit={setEditing} />
      </Card>

      <Card label="Background" heading>
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
      </Card>
    </SettingsSubpage>
  );
}
