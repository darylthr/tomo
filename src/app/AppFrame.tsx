import { Outlet } from 'react-router-dom';
import { DitherBackground } from '../features/background/DitherBackground';
import { SettingsSheet } from '../features/settings/SettingsSheet';
import styles from './AppFrame.module.css';
import { Header } from './Header';
import { NavBar } from './NavBar';

/** Chrome around the app: the framed panel (background, header, current screen) and the bottom navbar. */
export function AppFrame() {
  return (
    <div className={styles.app}>
      <main className={styles.frame}>
        <DitherBackground />
        <Header />
        <div className={styles.view}>
          <Outlet />
        </div>
      </main>
      <NavBar />
      <SettingsSheet />
    </div>
  );
}
