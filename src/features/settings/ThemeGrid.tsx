import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { useSettings } from '../../shared/settings/store';
import { BUILTINS, newTheme, type Colours } from '../../shared/theme/themes';
import styles from './ThemeGrid.module.css';

type Props = {
  /** Opens the editor for a theme. */
  onEdit: (id: string) => void;
};

/** Every built-in and custom theme as a card with a preview in that theme's own colours. */
export function ThemeGrid({ onEdit }: Props) {
  const theme = useSettings((s) => s.settings.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const cards = [
    ...BUILTINS.map((t) => ({ id: t.id, name: t.name, colours: { ...t.colours, ...theme.overrides[t.id] }, custom: false })),
    ...theme.custom.map((t) => ({ ...t, custom: true })),
  ];
  const current = cards.some((c) => c.id === theme.current) ? theme.current : 'tomo-dark';
  const groupRef = useRef<HTMLDivElement>(null);

  // A radio group: one Tab stop (the current theme); arrow keys move and pick, wrapping round.
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = cards[(index + step + cards.length) % cards.length]!;
    setTheme({ ...theme, current: next.id });
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-theme-id="${next.id}"]`)?.focus();
  };

  return (
    <>
      <div ref={groupRef} className={styles.grid} role="radiogroup" aria-label="Theme">
        {cards.map((c, i) => (
          <div key={c.id} className={styles.card} data-current={c.id === current || undefined}>
            <button
              type="button"
              role="radio"
              aria-checked={c.id === current}
              aria-label={c.name}
              data-theme-id={c.id}
              tabIndex={c.id === current ? 0 : -1}
              className={styles.pick}
              onClick={() => setTheme({ ...theme, current: c.id })}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              <Preview colours={c.colours} />
              <span className={styles.name}>
                <span className={styles.nameText}>{c.name}</span>
                {c.custom && <small>Custom</small>}
              </span>
            </button>
            <button type="button" className={styles.edit} aria-label={`Edit ${c.name}`} onClick={() => onEdit(c.id)}>
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {[6, 12, 18].map((x) => (
                  <circle key={x} cx={x} cy={12} r={1.8} />
                ))}
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        className={styles.newTheme}
        onClick={() => {
          const next = newTheme(theme);
          setTheme(next);
          onEdit(next.current);
        }}
      >
        New theme
      </button>
    </>
  );
}

function Preview({ colours }: { colours: Colours }) {
  return (
    <span className={styles.preview} style={{ '--p-bg': colours.bg, '--p-surface': colours.surface, '--p-ink': colours.ink, '--p-accent': colours.accent } as CSSProperties} aria-hidden="true">
      <i className={styles.line} />
      <span className={styles.miniCard}>
        <i className={styles.lineShort} />
        <i className={styles.pill} />
      </span>
    </span>
  );
}
