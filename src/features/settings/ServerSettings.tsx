import { ServerSection } from '../server/ServerSection';
import { SettingsSubpage } from './parts';

/** Settings → Server: the Suwayomi connection. */
export function ServerSettings() {
  return (
    <SettingsSubpage title="Server">
      <ServerSection heading={false} />
    </SettingsSubpage>
  );
}
