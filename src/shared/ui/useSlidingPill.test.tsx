import { render } from '@testing-library/react';
import { useRef } from 'react';
import { setMatchMedia } from '../../test/setup';
import { useSlidingPill } from './useSlidingPill';

// jsdom has no layout: read offsets from data attributes instead.
const props = ['offsetLeft', 'offsetTop', 'offsetWidth', 'offsetHeight'] as const;
const attr = { offsetLeft: 'left', offsetTop: 'top', offsetWidth: 'width', offsetHeight: 'height' } as const;
beforeAll(() => {
  for (const p of props) {
    Object.defineProperty(HTMLElement.prototype, p, {
      configurable: true,
      get(this: HTMLElement) {
        return Number(this.dataset[attr[p]] ?? 0);
      },
    });
  }
});

function Bar({ active, measure }: { active: string; measure?: string }) {
  const container = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  useSlidingPill(container, pill, active, { measure });
  return (
    <div ref={container}>
      <span ref={pill} data-testid="pill" />
      <button data-pill-key="a" data-left="0" data-width="80">
        A
      </button>
      <button data-pill-key="b" data-left="140" data-width="60">
        <span className="ic" data-left="19" data-top="8" data-width="60" data-height="32" />
      </button>
    </div>
  );
}

it('moves the pill to the active item', () => {
  const { getByTestId } = render(<Bar active="b" />);
  const pill = getByTestId('pill');
  expect(pill.style.transform).toBe('translate(140px, 0px)');
  expect(pill.style.width).toBe('60px');
});

it('measures a child of the active item when asked', () => {
  const { getByTestId } = render(<Bar active="b" measure=".ic" />);
  expect(getByTestId('pill').style.transform).toBe('translate(159px, 8px)');
});

it('places the first measurement instantly and animates later changes', () => {
  const { getByTestId, rerender } = render(<Bar active="a" />);
  expect(getByTestId('pill').dataset.instant).toBe('true');
  rerender(<Bar active="b" />);
  expect(getByTestId('pill').dataset.instant).toBe('false');
});

it('never animates under reduced motion', () => {
  setMatchMedia('(prefers-reduced-motion: reduce)', true);
  const { getByTestId, rerender } = render(<Bar active="a" />);
  rerender(<Bar active="b" />);
  expect(getByTestId('pill').dataset.instant).toBe('true');
});
