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
        url: normalizeServerUrl(suwayomiUrl ?? '') ?? '',
        webUiUrl: suwayomiWebUiUrl ?? '',
        authMode: authMode ?? 'none',
        configured: true,
      },
    });
  } catch {
    // offline, not deployed yet, or not JSON: keep defaults
  }
}

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:\/\//i;

/**
 * Turns what people type ("192.168.1.10:4567", "nas.local:4567/") into a full http(s) address
 * without a trailing slash. Empty stays empty (Suwayomi on Tomo's own address); null means invalid.
 */
export function normalizeServerUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return '';
  let url: URL;
  try {
    url = new URL(HAS_SCHEME.test(raw) ? raw : `http://${raw}`);
  } catch {
    return null;
  }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || !url.hostname) return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}

/** Resolves a server path against the Suwayomi address; absolute URLs pass through. */
export function resolveUrl(path: string, base: string = useSettings.getState().settings.server.url): string {
  if (/^[a-z][a-z\d+.-]*:/i.test(path)) return path;
  const root = normalizeServerUrl(base) || '';
  if (!root) return path;
  return `${root}/${path.replace(/^\/+/, '')}`;
}
