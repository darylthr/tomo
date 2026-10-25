import { averageColor, spineInk } from './coverColor';

function pixels(...colors: [number, number, number][]): Uint8ClampedArray {
  return Uint8ClampedArray.from(colors.flatMap(([r, g, b]) => [r, g, b, 255]));
}

it('averages the cover colors', () => {
  expect(averageColor(pixels([255, 0, 0], [255, 0, 0]))).toBe('#ff0000');
});

it('ignores near-white paper and near-black ink when there is color', () => {
  expect(averageColor(pixels([250, 250, 250], [250, 250, 250], [2, 2, 2], [40, 80, 200]))).toBe('#2850c8');
});

it('falls back to the plain average for black-and-white covers', () => {
  expect(averageColor(pixels([255, 255, 255], [0, 0, 0]))).toBe('#808080');
});

it('picks readable spine text', () => {
  expect(spineInk('#ffffff')).toBe('#111111');
  expect(spineInk('#202040')).toBe('#f4f4f6');
});
