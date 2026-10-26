import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Chapter } from '../../shared/model/types';
import { useSettings } from '../../shared/settings/store';
import { ReaderChrome } from './ReaderChrome';
import { useReader } from './readerStore';

const chapter: Chapter = {
  id: 11,
  titleId: 1,
  name: 'Chapter 2',
  number: 2,
  order: 2,
  read: false,
  bookmarked: false,
  lastPage: 0,
  pageCount: 8,
  uploadedAt: 0,
  scanlator: null,
};

function show(props: Partial<React.ComponentProps<typeof ReaderChrome>> = {}) {
  useReader.getState().open(chapter, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 2, 'rtl');
  const onBack = vi.fn();
  render(
    <ReaderChrome
      titleName="Blue Hour"
      chapterName="Chapter 2"
      onBack={onBack}
      onPrevChapter={null}
      onNextChapter={() => {}}
      onModeChange={(m) => useReader.getState().setMode(m)}
      {...props}
    />,
  );
  return { onBack };
}

beforeEach(() => useSettings.getState().reset());

it('names the title and chapter', () => {
  show();
  expect(screen.getByText('Blue Hour')).toBeInTheDocument();
  expect(screen.getByText('Chapter 2')).toBeInTheDocument();
});

it('shows one line per page, running right to left for manga', () => {
  show();
  const slider = screen.getByRole('slider', { name: 'Page' });
  expect(slider).toHaveAttribute('aria-valuetext', 'Page 3 of 8');
  expect(slider).toHaveAttribute('dir', 'rtl');
  expect(slider.querySelectorAll('[data-tick]')).toHaveLength(8);
});

it('keeps reading options tucked away until asked for', async () => {
  show();
  const button = screen.getByRole('button', { name: 'Reading options' });
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('radiogroup', { name: 'Reading mode' })).not.toBeInTheDocument();
  await userEvent.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('radiogroup', { name: 'Reading mode' })).toBeInTheDocument();
  expect(screen.getByRole('slider', { name: 'Brightness' })).toBeInTheDocument();
  expect(screen.getByRole('slider', { name: 'Warmth' })).toBeInTheDocument();
});

it('changes brightness with the line slider', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Reading options' }));
  const brightness = screen.getByRole('slider', { name: 'Brightness' });
  brightness.focus();
  await userEvent.keyboard('{ArrowLeft}');
  expect(useSettings.getState().settings.reader.brightness).toBe(0.95);
  expect(brightness).toHaveAttribute('aria-valuetext', '95%');
});

it('changes the reading mode from the options', async () => {
  show();
  await userEvent.click(screen.getByRole('button', { name: 'Reading options' }));
  await userEvent.click(screen.getByRole('radio', { name: 'Webtoon' }));
  expect(useReader.getState().mode).toBe('webtoon');
});

it('Escape closes the options before it leaves the reader', async () => {
  const { onBack } = show();
  const leave = vi.fn();
  window.addEventListener('keydown', leave);
  await userEvent.click(screen.getByRole('button', { name: 'Reading options' }));
  await userEvent.keyboard('{Escape}');
  expect(screen.queryByRole('radiogroup', { name: 'Reading mode' })).not.toBeInTheDocument();
  expect(leave).not.toHaveBeenCalled();
  expect(onBack).not.toHaveBeenCalled();
  window.removeEventListener('keydown', leave);
});
