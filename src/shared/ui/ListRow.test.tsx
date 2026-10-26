import { render, screen } from '@testing-library/react';
import { chapterLabel, Thumb } from './ListRow';

it('labels chapters by number, falling back to the name', () => {
  expect(chapterLabel({ number: 42, name: 'x' })).toBe('Ch. 42');
  expect(chapterLabel({ number: 10.5, name: 'x' })).toBe('Ch. 10.5');
  expect(chapterLabel({ number: -1, name: 'Oneshot' })).toBe('Oneshot');
});

it('shows a letter when a title has no cover', () => {
  render(<Thumb src={null} title="Kintsugi" />);
  expect(screen.getByText('K')).toBeInTheDocument();
});

it('shows the cover image when there is one', () => {
  const { container } = render(<Thumb src="https://tomo.home/c.jpg" title="Kintsugi" />);
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://tomo.home/c.jpg');
});
