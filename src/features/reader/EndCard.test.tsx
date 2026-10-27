import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Chapter } from '../../shared/model/types';
import { EndCard } from './EndCard';

const ch = (number: number, patch: Partial<Chapter> = {}) => ({ id: number, name: `Chapter ${number}`, number, scanlator: 'Dusk Scans', ...patch }) as Chapter;

it('names the next chapter and notes a different group and missing chapters', async () => {
  const onNext = vi.fn();
  render(<EndCard current={ch(12)} next={ch(15, { name: 'Last Stop', scanlator: 'Moon Team' })} onNext={onNext} onBack={vi.fn()} onLibrary={vi.fn()} />);
  expect(screen.getByText('Finished · Ch. 12')).toBeInTheDocument();
  expect(screen.getByText('Next · Ch. 15: Last Stop')).toBeInTheDocument();
  expect(screen.getByText('Different group: Moon Team')).toBeInTheDocument();
  expect(screen.getByText('2 chapters missing')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Next chapter' }));
  expect(onNext).toHaveBeenCalled();
});

it('keeps it simple for the next chapter in line', () => {
  render(<EndCard current={ch(12)} next={ch(13)} onNext={vi.fn()} onBack={vi.fn()} onLibrary={vi.fn()} />);
  expect(screen.getByText('Next · Ch. 13')).toBeInTheDocument();
  expect(screen.queryByText(/missing|Different group/)).toBeNull();
});

it('says all caught up without a next chapter', async () => {
  const onLibrary = vi.fn();
  render(<EndCard current={ch(12)} next={null} onNext={vi.fn()} onBack={vi.fn()} onLibrary={onLibrary} />);
  expect(screen.getByText("You're all caught up")).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Back to library' }));
  expect(onLibrary).toHaveBeenCalled();
});

it("doesn't repeat the chapter number when the name already has it", () => {
  render(<EndCard current={ch(2)} next={ch(3, { name: 'Chapter 3: Last Stop' })} onNext={vi.fn()} onBack={vi.fn()} onLibrary={vi.fn()} />);
  expect(screen.getByText('Next · Ch. 3: Last Stop')).toBeInTheDocument();
});

it('notes a different group only when both groups are known', () => {
  render(<EndCard current={ch(2, { scanlator: null })} next={ch(3)} onNext={vi.fn()} onBack={vi.fn()} onLibrary={vi.fn()} />);
  expect(screen.queryByText(/Different group/)).toBeNull();
});
