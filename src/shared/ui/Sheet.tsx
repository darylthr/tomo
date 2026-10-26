import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconClose } from './icons';
import styles from './Sheet.module.css';
import { prefersReducedMotion } from './useReducedMotion';

type Props = {
  open: boolean;
  /** The dialog's accessible name. */
  label: string;
  title: string;
  closeLabel?: string;
  onClose: () => void;
  /** Shown in the header, before the close button. */
  action?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
};

const EXIT_MS = 150;

/** A modal sheet: a bottom sheet on phones, a side panel on wide screens. */
export function Sheet({ open, label, title, closeLabel = 'Close', onClose, action, footer, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // `entered` flips a frame after opening so the sheet transitions in; closing hides it at once.
  const [entered, setEntered] = useState(false);
  const shown = open && entered;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) {
        if (dialog.showModal) dialog.showModal();
        else dialog.setAttribute('open', '');
      }
      const frame = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(frame);
    }
    if (!dialog.open) return;
    const timer = setTimeout(
      () => {
        setEntered(false);
        if (dialog.close) dialog.close();
        else dialog.removeAttribute('open');
      },
      prefersReducedMotion() ? 0 : EXIT_MS,
    );
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      data-shown={shown}
      aria-label={label}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div className={styles.sheet}>
        <header className={styles.head}>
          <h2 className={styles.title}>{title}</h2>
          {action}
          <button type="button" className={styles.close} aria-label={closeLabel} onClick={onClose}>
            <IconClose />
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.foot}>{footer}</footer>}
      </div>
    </dialog>
  );
}
