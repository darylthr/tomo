import { z } from 'zod';
import { useSettings } from '../../shared/settings/store';

const configFile = z.object({
  suwayomiUrl: z.string().optional(),
  suwayomiWebUiUrl: z.string().optional(),
  authMode: z.enum(['none', 'basic_auth']).optional(),
});

/**
 * On first launch, prefill the server settings from `/tomo.config.json`, which the
 * home-server setup writes next to Tomo. A missing or broken file is ignored.
 */
export async function loadServerConfig(fetchImpl: typeof fetch = fetch): Promise<void> {
  if (useSettings.getState().settings.server.configured) return;
  try {
    const res = await fetchImpl('/tomo.config.json', { cache: 'no-store' });
    if (!res.ok) return;
    const parsed = configFile.safeParse(await res.json());
    if (!parsed.success) return;
    const { suwayomiUrl, suwayomiWebUiUrl, authMode } = parsed.data;
    useSettings.getState().update({
      server: {
        url: suwayomiUrl ?? '',
        webUiUrl: suwayomiWebUiUrl ?? '',
        authMode: authMode ?? 'none',
        configured: true,
      },
    });
  } catch {
    // offline, not deployed yet, or not JSON: keep defaults
  }
}

/** Resolves a server path against the Suwayomi address; absolute URLs pass through. */
export function resolveUrl(path: string, base: string = useSettings.getState().settings.server.url): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) return path;
  if (!base) return path;
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
