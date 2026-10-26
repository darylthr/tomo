import { preferredMode } from './mode';

it('opens long strips as webtoons', () => {
  for (const genre of ['Long Strip', 'Webtoon', 'Manhwa', 'manhua', 'Webtoons'])
    expect(preferredMode({ genres: ['Action', genre] })).toBe('webtoon');
});

it('has no opinion about other titles', () => {
  expect(preferredMode({ genres: ['Action', 'Romance'] })).toBeNull();
  expect(preferredMode({ genres: [] })).toBeNull();
});

it('prefers the mode the metadata job chose', () => {
  expect(preferredMode({ genres: ['Manhwa'], readingMode: 'rtl' })).toBe('rtl');
  expect(preferredMode({ genres: [], readingMode: 'webtoon' })).toBe('webtoon');
});
