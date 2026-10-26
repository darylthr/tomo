import { useRef, type ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { IconHistory, IconLibrary, IconSearch, IconSettings, IconUpdates } from '../shared/ui/icons';
import { useSlidingPill } from '../shared/ui/useSlidingPill';
import { useUi } from '../shared/ui/uiStore';
import styles from './NavBar.module.css';

type Tab = { to: string; label: string; Icon: ComponentType<{ filled?: boolean }> };

const TABS: Tab[] = [
  { to: '/', label: 'Library', Icon: IconLibrary },
  { to: '/updates', label: 'Updates', Icon: IconUpdates },
  { to: '/history', label: 'History', Icon: IconHistory },
  { to: '/search', label: 'Search', Icon: IconSearch },
  { to: '/settings', label: 'Settings', Icon: IconSettings },
];

function activeTab(pathname: string): string {
  return TABS.find((t) => t.to !== '/' && pathname.startsWith(t.to))?.to ?? '/';
}

export function NavBar() {
  const { pathname } = useLocation();
  const badge = useUi((s) => s.updatesBadge);
  const tabsRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const active = activeTab(pathname);
  useSlidingPill(tabsRef, pillRef, active, { measure: `.${styles.ic}` });

  return (
    <nav className={styles.nav} aria-label="Sections">
      <div className={styles.tabs} ref={tabsRef} role="tablist">
        <span className={styles.pill} ref={pillRef} aria-hidden="true" />
        {TABS.map(({ to, label, Icon }) => {
          const selected = to === active;
          return (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              role="tab"
              aria-selected={selected}
              aria-label={label}
              data-pill-key={to}
              className={styles.tab}
            >
              <span className={styles.ic}>
                <Icon filled={selected} />
                {to === '/updates' && badge > 0 && <span className={styles.badge}>{badge}</span>}
              </span>
              <span className={styles.label}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
