import { useRef, type KeyboardEvent } from 'react';
import styles from './Segmented.module.css';
import { useSlidingPill } from './useSlidingPill';

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  options: Option<T>[];
  /** null: nothing chosen (the pill hides), as when a search replaces the listing. */
  value: T | null;
  onChange: (value: T) => void;
};

/** A radio group drawn as a pill track; the white pill slides to the chosen option. */
export function Segmented<T extends string>({ label, options, value, onChange }: Props<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  useSlidingPill(groupRef, pillRef, value ?? '');

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const index = options.findIndex((o) => o.value === value);
    const next = options[index < 0 ? (step > 0 ? 0 : options.length - 1) : (index + step + options.length) % options.length]!;
    onChange(next.value);
    groupRef.current?.querySelector<HTMLButtonElement>(`[data-pill-key="${next.value}"]`)?.focus();
  };

  return (
    <div ref={groupRef} className={styles.group} role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      <span ref={pillRef} className={styles.pill} aria-hidden="true" />
      {options.map((o, i) => {
        const checked = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (value === null && i === 0) ? 0 : -1}
            data-pill-key={o.value}
            className={styles.option}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
