import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../../shared/settings/store';
import { IconBook, IconChevron, IconLibrary, IconPalette, IconServer } from '../../shared/ui/icons';
import list from '../../shared/ui/List.module.css';
import { Page } from '../../shared/ui/Page';
import { useLibrary } from '../library/libraryStore';
import { FITS, MODES } from './parts';
import styles from './Settings.module.css';

const THEMES = { dark: 'Dark', light: 'Light', custom: 'Custom theme' } as const;

/** The Settings tab: a list of sections, each on its own page. */
export function SettingsPage() {
  const { server, library, reader, theme, background } = useSettings((s) => s.settings);
  const categoryCount = useLibrary((s) => (s.status === 'ready' ? s.categories.filter((c) => c.id > 0).length : null));

  const sections: { to: string; name: string; summary: string; icon: ReactNode }[] = [
    { to: 'server', name: 'Server', summary: server.url || 'Same address as Tomo', icon: <IconServer /> },
    {
      to: 'library',
      name: 'Library',
      summary: [
        library.display === 'books' ? 'Books' : 'Covers',
        categoryCount !== null && `${categoryCount} ${categoryCount === 1 ? 'category' : 'categories'}`,
      ]
        .filter(Boolean)
        .join(' · '),
      icon: <IconLibrary />,
    },
    {
      to: 'reader',
      name: 'Reader',
      summary: `${MODES.find((m) => m.value === reader.defaultMode)?.label} · Fit ${FITS.find((f) => f.value === reader.fit)?.label.toLowerCase()}`,
      icon: <IconBook />,
    },
    {
      to: 'customization',
      name: 'Customization',
      summary: `${THEMES[theme.mode]} · ${background.enabled && background.imageKey ? 'Dithered background' : 'No background image'}`,
      icon: <IconPalette />,
    },
  ];

  return (
    <Page title="Settings">
      <ul className={list.group} aria-label="Settings sections">
        {sections.map((s) => (
          <li key={s.to}>
            <Link to={`/settings/${s.to}`} className={list.row}>
              <span className={styles.sectionIcon} aria-hidden="true">
                {s.icon}
              </span>
              <span className={list.rowText}>
                <span className={list.rowTitle}>{s.name}</span>
                <span className={list.rowSub}>{s.summary}</span>
              </span>
              <span className={list.rowSide}>
                <IconChevron className={list.chevron} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Page>
  );
}
