import type { Chapter } from '../../shared/model/types';
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
  pageCount: 3,
  uploadedAt: 0,
  scanlator: null,
};

beforeEach(() => useReader.getState().open(chapter, ['a', 'b', 'c'], 0, 'rtl'));

it('keeps the page inside the chapter', () => {
  useReader.getState().goTo(10);
  expect(useReader.getState().index).toBe(2);
  useReader.getState().goTo(-4);
  expect(useReader.getState().index).toBe(0);
});

it('asks for the next chapter when turning past the last page', () => {
  const onChapterEnd = vi.fn();
  useReader.setState({ onChapterEnd });
  useReader.getState().goTo(2);
  useReader.getState().next();
  expect(onChapterEnd).toHaveBeenCalledTimes(1);
  expect(useReader.getState().index).toBe(2);
});

it('asks for the previous chapter when turning back from the first page', () => {
  const onChapterStart = vi.fn();
  useReader.setState({ onChapterStart });
  useReader.getState().prev();
  expect(onChapterStart).toHaveBeenCalledTimes(1);
});

it('starts at the requested page and shows the controls', () => {
  useReader.getState().open(chapter, ['a', 'b', 'c'], 1, 'ltr');
  expect(useReader.getState()).toMatchObject({ index: 1, mode: 'ltr', chromeVisible: true });
});

it('hides the controls after the first page turn', () => {
  useReader.getState().next();
  expect(useReader.getState().chromeVisible).toBe(false);
});
