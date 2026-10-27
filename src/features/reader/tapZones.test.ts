import { tapAction } from './tapZones';

it('follows the reading direction', () => {
  expect(tapAction(0.1, 'rtl', 'default')).toBe('next');
  expect(tapAction(0.9, 'rtl', 'default')).toBe('prev');
  expect(tapAction(0.1, 'ltr', 'default')).toBe('prev');
  expect(tapAction(0.9, 'ltr', 'default')).toBe('next');
  expect(tapAction(0.1, 'vertical', 'default')).toBe('prev');
  expect(tapAction(0.9, 'vertical', 'default')).toBe('next');
  expect(tapAction(0.5, 'rtl', 'default')).toBe('chrome');
});

it('swaps sides when inverted', () => {
  expect(tapAction(0.1, 'rtl', 'inverted')).toBe('prev');
  expect(tapAction(0.9, 'ltr', 'inverted')).toBe('prev');
  expect(tapAction(0.5, 'ltr', 'inverted')).toBe('chrome');
});

it('only toggles the controls when tap zones are off', () => {
  expect(tapAction(0.1, 'rtl', 'off')).toBe('chrome');
  expect(tapAction(0.9, 'ltr', 'off')).toBe('chrome');
});
