import { useState } from 'react';
import { useSettings } from '../../shared/settings/store';
import { Segmented } from '../../shared/ui/Segmented';
import styles from '../settings/Settings.module.css';
import { getAbout } from './api';
import { ServerError } from './client';
import { normalizeServerUrl, resolveUrl } from './config';

type Check = { state: 'idle' | 'checking' } | { state: 'ok'; version: string } | { state: 'failed'; message: string; details?: string };

/** Settings for the Suwayomi connection: address, login mode and a connection test. */
export function ServerSection() {
  const server = useSettings((s) => s.settings.server);
  const update = useSettings((s) => s.update);
  const [draft, setDraft] = useState(server.url);
  const [check, setCheck] = useState<Check>({ state: 'idle' });
  const [invalid, setInvalid] = useState(false);

  /** Saves the address in its full form; returns false when it isn't a web address. */
  const saveUrl = (value: string) => {
    const url = normalizeServerUrl(value);
    setInvalid(url === null);
    if (url === null) return false;
    setDraft(url);
    if (url === server.url && server.configured) return true;
    update({ server: { url, configured: true } });
    // Reload the shelf from the new address (lazy import keeps this section free of library code).
    void import('../library/libraryStore').then(({ useLibrary }) => useLibrary.getState().refresh());
    return true;
  };

  const test = async () => {
    if (!saveUrl(draft)) return;
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
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'server-url-error' : undefined}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => saveUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </div>
      {invalid && (
        <p id="server-url-error" className={styles.error} role="alert">
          Enter an address like http://192.168.1.10:4567
        </p>
      )}
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
