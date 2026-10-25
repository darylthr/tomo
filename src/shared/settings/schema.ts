import { z } from 'zod';

const hex = (fallback: string) =>
  z
    .string()
    .regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
    .catch(fallback);

const themeSchema = z.object({
  mode: z.enum(['dark', 'light', 'custom']).catch('dark'),
  bg: hex('#0e0e10'),
  ink: hex('#f1f1f4'),
  accent: hex('#8b6cff'),
});

const backgroundSchema = z.object({
  /** Opt-in: stays off until an image has been chosen. */
  enabled: z.boolean().catch(false),
  /** Quantisation levels per channel: Low 4 / Mid 6 / High 9. */
  levels: z.union([z.literal(4), z.literal(6), z.literal(9)]).catch(6),
  /** Dither cell size in CSS px: Fine 2 / Mid 3 / Coarse 4. */
  cell: z.union([z.literal(2), z.literal(3), z.literal(4)]).catch(2),
  imageKey: z.string().nullable().catch(null),
});

const librarySchema = z.object({
  display: z.enum(['books', 'covers']).catch('books'),
  scroll: z.enum(['horizontal', 'vertical']).catch('horizontal'),
  fadeSides: z.boolean().catch(true),
  styledLogos: z.boolean().catch(true),
  detail: z.enum(['full', 'lite']).catch('full'),
  mirrorRtl: z.boolean().catch(false),
});

const serverSchema = z.object({
  /** Suwayomi base address; empty means the same origin as Tomo. */
  url: z.string().trim().catch(''),
  /** Where Suwayomi's own web UI lives, for managing extensions. */
  webUiUrl: z.string().trim().catch(''),
  authMode: z.enum(['none', 'basic_auth']).catch('none'),
  /** Set once the owner (or tomo.config.json) has chosen the server. */
  configured: z.boolean().catch(false),
});

const readerMode = z.enum(['rtl', 'ltr', 'webtoon', 'vertical']);

const readerSchema = z.object({
  defaultMode: readerMode.catch('rtl'),
  /** Per-title overrides keyed by title id; unknown modes are dropped one by one. */
  modes: z
    .record(z.string(), z.unknown())
    .transform((entries) =>
      Object.fromEntries(Object.entries(entries).filter(([, v]) => readerMode.safeParse(v).success)) as Record<
        string,
        z.infer<typeof readerMode>
      >,
    )
    .catch({}),
  fit: z.enum(['screen', 'width', 'height']).catch('screen'),
  brightness: z.number().min(0.2).max(1).catch(1),
  warm: z.number().min(0).max(1).catch(0),
  pageTransitions: z.boolean().catch(true),
});

// Each section parses an empty object when missing or invalid, so one bad
// field never resets its neighbours and a bad section never breaks boot.
const section = <T extends z.ZodObject>(schema: T) => schema.catch(() => schema.parse({}));

export const settingsSchema = z.object({
  theme: section(themeSchema),
  background: section(backgroundSchema),
  library: section(librarySchema),
  server: section(serverSchema),
  reader: section(readerSchema),
});

export type Settings = z.infer<typeof settingsSchema>;
export type ThemeSettings = Settings['theme'];
export type ThemeMode = ThemeSettings['mode'];
export type BackgroundSettings = Settings['background'];
export type LibrarySettings = Settings['library'];
export type ServerSettings = Settings['server'];
export type ReaderSettings = Settings['reader'];

export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? (T[K] extends unknown[] ? T[K] : DeepPartial<T[K]>) : T[K] };

export const DEFAULTS: Settings = settingsSchema.parse({});

/** Parses anything into valid settings; never throws. */
export function parseSettings(raw: unknown): Settings {
  const result = settingsSchema.safeParse(raw);
  return result.success ? result.data : DEFAULTS;
}
