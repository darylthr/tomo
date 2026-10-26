import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { DitherBackground } from '../features/background/DitherBackground';
import { useUpdates } from '../features/updates/updatesStore';
import styles from './AppFrame.module.css';
import { Header } from './Header';
import { NavBar } from './NavBar';

// Once per app open, not per mount (StrictMode mounts twice; the reader unmounts the frame).
let checkedOnOpen = false;

/** Chrome around the app: the framed panel (background, header, current screen) and the bottom navbar. */
export function AppFrame() {
  useEffect(() => {
    if (checkedOnOpen) return;
    checkedOnOpen = true;
    void useUpdates.getState().check();
  }, []);

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
    </div>
  );
}
