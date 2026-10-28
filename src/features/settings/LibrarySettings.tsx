import { Link } from 'react-router-dom';
import type { LibrarySettings as LibraryPrefs } from '../../shared/settings/schema';
import { useSettings } from '../../shared/settings/store';
import { IconChevron } from '../../shared/ui/icons';
import { Segmented } from '../../shared/ui/Segmented';
import { Switch } from '../../shared/ui/Switch';
import { useLibrary } from '../library/libraryStore';
import { Card, Row, SettingsSubpage } from './parts';
import styles from './Settings.module.css';

/** Settings → Library: categories and how the shelf looks. */
export function LibrarySettings() {
  // Shown once the library has loaded (the shelf loads it); Settings doesn't fetch it itself.
  const categoryCount = useLibrary((s) => (s.status === 'ready' ? s.categories.filter((c) => c.id > 0).length : null));
  const library = useSettings((s) => s.settings.library);
  const update = useSettings((s) => s.update);
  const lib = (patch: Partial<LibraryPrefs>) => update({ library: patch });

  return (
    <SettingsSubpage title="Library">
      <Card label="Library">
        <Link
          to="/settings/categories"
          className={`${styles.row} ${styles.link}`}
          aria-label={categoryCount === null ? 'Categories' : `Categories, ${categoryCount}`}
        >
          <span className={styles.label}>Categories</span>
          <span className={styles.linkSide}>
            {categoryCount}
            <IconChevron className={styles.chevron} />
          </span>
        </Link>
        <Link to="/settings/restore" className={`${styles.row} ${styles.link}`}>
          <span className={styles.label}>Restore from backup</span>
          <span className={styles.linkSide}>
            <IconChevron className={styles.chevron} />
          </span>
        </Link>
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
        {library.scroll === 'vertical' && (
          <>
            <Row label="Grid size">
              <Segmented
                label="Grid size"
                value={library.gridSize}
                onChange={(gridSize) => lib({ gridSize })}
                options={[
                  { value: 's', label: 'Small' },
                  { value: 'm', label: 'Medium' },
                  { value: 'l', label: 'Large' },
                ]}
              />
            </Row>
            <Row label="Show titles under books">
              <Switch label="Show titles under books" checked={library.gridTitles} onChange={(gridTitles) => lib({ gridTitles })} />
            </Row>
            <Row label="Show chapters left">
              <Switch label="Show chapters left" checked={library.gridProgress} onChange={(gridProgress) => lib({ gridProgress })} />
            </Row>
          </>
        )}
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
      </Card>
    </SettingsSubpage>
  );
}
