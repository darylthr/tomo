import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { TickSlider } from './TickSlider';

function Harness({ dir, start = 3, onChange }: { dir?: 'ltr' | 'rtl'; start?: number; onChange?: (v: number) => void }) {
  const [value, setValue] = useState(start);
  return (
    <TickSlider
      label="Page"
      min={1}
      max={8}
      value={value}
      dir={dir}
      valueText={(v) => `Page ${v} of 8`}
      onChange={(v) => {
        setValue(v);
        onChange?.(v);
      }}
    />
  );
}

beforeAll(() => {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 700,
    height: 36,
    right: 700,
    bottom: 36,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

it('is a slider with its value spelled out', () => {
  render(<Harness />);
  const slider = screen.getByRole('slider', { name: 'Page' });
  expect(slider).toHaveAttribute('aria-valuenow', '3');
  expect(slider).toHaveAttribute('aria-valuemin', '1');
  expect(slider).toHaveAttribute('aria-valuemax', '8');
  expect(slider).toHaveAttribute('aria-valuetext', 'Page 3 of 8');
});

it('draws one line per step', () => {
  const { container } = render(<Harness />);
  expect(container.querySelectorAll('[data-tick]')).toHaveLength(8);
  expect(container.querySelector('[data-tick][data-current]')).toHaveAttribute('data-tick', '3');
  expect(container.querySelectorAll('[data-tick][data-done]')).toHaveLength(3);
});

it('moves with the arrow keys, Home and End', async () => {
  render(<Harness />);
  const slider = screen.getByRole('slider');
  slider.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(slider).toHaveAttribute('aria-valuenow', '4');
  await userEvent.keyboard('{End}');
  expect(slider).toHaveAttribute('aria-valuenow', '8');
  await userEvent.keyboard('{Home}');
  expect(slider).toHaveAttribute('aria-valuenow', '1');
});

it('runs right to left for manga: the left arrow moves forward', async () => {
  render(<Harness dir="rtl" />);
  const slider = screen.getByRole('slider');
  slider.focus();
  await userEvent.keyboard('{ArrowLeft}');
  expect(slider).toHaveAttribute('aria-valuenow', '4');
});

it('jumps to the line under the pointer and follows a drag', () => {
  const onChange = vi.fn();
  render(<Harness onChange={onChange} />);
  const slider = screen.getByRole('slider');
  slider.setPointerCapture = () => {};
  fireEvent.pointerDown(slider, { clientX: 690, pointerId: 1 });
  expect(slider).toHaveAttribute('aria-valuenow', '8');
  fireEvent.pointerMove(slider, { clientX: 10, pointerId: 1 });
  expect(slider).toHaveAttribute('aria-valuenow', '1');
  fireEvent.pointerUp(slider, { pointerId: 1 });
  fireEvent.pointerMove(slider, { clientX: 400, pointerId: 1 });
  expect(slider).toHaveAttribute('aria-valuenow', '1');
});

it('mirrors the pointer for right-to-left', () => {
  render(<Harness dir="rtl" />);
  const slider = screen.getByRole('slider');
  slider.setPointerCapture = () => {};
  fireEvent.pointerDown(slider, { clientX: 10, pointerId: 1 });
  expect(slider).toHaveAttribute('aria-valuenow', '8');
});

it('thins out the lines when there are more steps than room', () => {
  const { container } = render(<TickSlider label="Page" min={1} max={400} value={1} onChange={() => {}} />);
  const ticks = container.querySelectorAll('[data-tick]').length;
  expect(ticks).toBeLessThanOrEqual(140);
  expect(ticks).toBeGreaterThan(40);
});
