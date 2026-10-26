import { useState } from 'react';
import type { Title } from '../model/types';
import { useSettings } from '../settings/store';
import styles from './TitleName.module.css';

/**
 * A title's name: its official logo when the metadata job found one and styled logos are on,
 * otherwise the text. Goes inside a heading, which keeps the name for screen readers either way.
 */
export function TitleName({ title, size = 'md' }: { title: Pick<Title, 'title' | 'logoUrl'>; size?: 'md' | 'lg' }) {
  const styled = useSettings((s) => s.settings.library.styledLogos);
  const [failed, setFailed] = useState<string | null>(null);
  const logo = styled && title.logoUrl && failed !== title.logoUrl ? title.logoUrl : null;
  if (!logo) return <>{title.title}</>;
  return (
    <img
      className={`${styles.logo} ${styles[size]}`}
      src={logo}
      alt={title.title}
      decoding="async"
      draggable={false}
      onError={() => setFailed(logo)}
    />
  );
}
