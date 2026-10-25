import { useState } from 'react';
import { useSettings } from '../../shared/settings/store';
import { Segmented } from '../../shared/ui/Segmented';
import styles from '../settings/SettingsSheet.module.css';
import { getAbout } from './api';
import { ServerError } from './client';
import { resolveUrl } from './config';

type Check = { state: 'idle' | 'checking' } | { state: 'ok'; version: string } | { state: 'failed'; message: string; details?: string };

/** Settings for the Suwayomi connection: address, login mode and a connection test. */
export function ServerSection() {
  const server = useSettings((s) => s.settings.server);
  const update = useSettings((s) => s.update);
  const [draft, setDraft] = useState(server.url);
  const [check, setCheck] = useState<Check>({ state: 'idle' });

  const saveUrl = (value: string) => {
    const url = value.trim();
    if (url === server.url && server.configured) return;
    update({ server: { url, configured: true } });
    // Reload the shelf from the new address (lazy import keeps this section free of library code).
    void import('../library/libraryStore').then(({ useLibrary }) => useLibrary.getState().refresh());
  };

  const test = async () => {
    saveUrl(draft);
    setCheck({ state: 'checking' });
    try {
      const about = await getAbout();
      setCheck({ state: 'ok', version: about.version });
    } catch (e) {
      const err = e instanceof ServerError ? e : new ServerError('server', String(e));
      setCheck({ state: 'failed', message: err.message, details: err.details });
    }
  };

  return (
    <section className={styles.section} aria-label="Server">
      <h3 className={styles.heading}>Server</h3>
      <div className={styles.row}>
        <label className={styles.label} htmlFor="server-url">
          Server address
        </label>
        <input
          id="server-url"
          className={styles.field}
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="Same address as Tomo"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => saveUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </div>
      <div className={styles.row}>
        <span className={styles.label}>Login</span>
        <Segmented
          label="Login"
          value={server.authMode}
          onChange={(authMode) => update({ server: { authMode } })}
          options={[
            { value: 'none', label: 'None' },
            { value: 'basic_auth', label: 'Basic' },
          ]}
        />
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} onClick={() => void test()} disabled={check.state === 'checking'}>
          {check.state === 'checking' ? 'Testing…' : 'Test connection'}
        </button>
        <a className={styles.ghost} href={server.webUiUrl || resolveUrl('/')} target="_blank" rel="noreferrer">
          Manage extensions in Suwayomi
        </a>
      </div>
      {check.state === 'ok' && <p className={styles.success}>Connected to Suwayomi {check.version}</p>}
      {check.state === 'failed' && (
        <p className={styles.error} role="alert">
          {check.message}
          {check.details && <span className={styles.details}> · {check.details}</span>}
        </p>
      )}
    </section>
  );
}
