import { cropBox } from './crop';

/** A w×h image of `margin` colour with a `content` block in the given box. */
function image(w: number, h: number, margin: number, content: { x0: number; y0: number; x1: number; y1: number; value?: number }) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const inside = x >= content.x0 && x < content.x1 && y >= content.y0 && y < content.y1;
      const v = inside ? (content.value ?? (margin > 128 ? 0 : 255)) : margin;
      data.set([v, v, v, 255], (y * w + x) * 4);
    }
  return data;
}

it('finds white margins and keeps a safety margin', () => {
  expect(cropBox(image(100, 100, 255, { x0: 20, y0: 20, x1: 80, y1: 80 }), 100, 100)).toEqual({ x: 16, y: 16, w: 68, h: 68 });
});

it('finds black margins', () => {
  expect(cropBox(image(100, 100, 0, { x0: 10, y0: 25, x1: 90, y1: 75 }), 100, 100)).toEqual({ x: 6, y: 21, w: 88, h: 58 });
});

it('leaves pages without uniform margins alone', () => {
  // a grey border is neither white nor black
  expect(cropBox(image(100, 100, 128, { x0: 20, y0: 20, x1: 80, y1: 80, value: 30 }), 100, 100)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
});

it('refuses crops that would remove too much', () => {
  expect(cropBox(image(100, 100, 255, { x0: 45, y0: 10, x1: 55, y1: 90 }), 100, 100)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
});
