import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { Category } from '../../shared/model/types';
import { useSlidingPill } from '../../shared/ui/useSlidingPill';
import styles from './CategoryBar.module.css';

export type CategoryFilter = number | 'all';

type Props = {
  categories: Category[];
  counts: Map<CategoryFilter, number>;
  value: CategoryFilter;
  /** False leaves the All tab out of the bar. */
  showAll?: boolean;
  onChange: (value: CategoryFilter) => void;
  /** A control after the tabs, inside the bar (the sort button). */
  action?: ReactNode;
};

/** Floating category tabs with a sliding white pill (spec §6.1). */
export function CategoryBar({ categories, counts, value, showAll = true, onChange, action }: Props) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState({ more: false, scrolled: false });
  useSlidingPill(tabsRef, pillRef, String(value));

  const items: { key: CategoryFilter; name: string }[] = [
    ...(showAll ? [{ key: 'all' as CategoryFilter, name: 'All' }] : []),
    ...categories.map((c) => ({ key: c.id, name: c.name })),
  ];

  const measure = () => {
    const el = tabsRef.current;
    if (!el) return;
    setOverflow({
      more: el.scrollWidth - el.clientWidth - el.scrollLeft > 4,
      scrolled: el.scrollLeft > 4,
    });
  };
  useLayoutEffect(measure, [categories.length]);

  // The tab changes by swipe too: keep it in sight.
  useEffect(() => {
    tabsRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [value]);

  return (
    <nav className={styles.bar} aria-label="Category bar">
      <div
        ref={tabsRef}
        className={`${styles.tabs} ${overflow.more ? styles.fadeEnd : ''} ${overflow.scrolled ? styles.fadeStart : ''}`}
        role="tablist"
        aria-label="Categories"
        onScroll={measure}
      >
        <span ref={pillRef} className={styles.pill} aria-hidden="true" />
        {items.map(({ key, name }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={key === value}
            data-pill-key={String(key)}
            className={styles.tab}
            onClick={() => onChange(key)}
          >
            {name}
            <span className={styles.count}>{(counts.get(key) ?? 0).toLocaleString()}</span>
          </button>
        ))}
      </div>
      {action}
    </nav>
  );
}
