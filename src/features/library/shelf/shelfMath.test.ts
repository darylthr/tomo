import { bookTransform, shelfLayout, visibleRange } from './shelfMath';

describe('shelfLayout', () => {
  it('sizes books for a phone (46% share)', () => {
    const l = shelfLayout(378, 470, 'books');
    expect(l).toMatchObject({ H: 256, W: 174, D: 44 });
    expect(l.pitch).toBe(Math.round(1.06 * 174 + 0.6 * 44 + Math.max(22, 0.09 * 256)));
    expect(l.padL).toBe(Math.round(378 / 2 - l.pitch / 2));
  });

  it('sizes books for a wide screen (54% share)', () => {
    expect(shelfLayout(1200, 520, 'books')).toMatchObject({ H: 385, W: 262 });
  });

  it('packs flat covers tighter', () => {
    const l = shelfLayout(378, 470, 'covers');
    expect(l.pitch).toBe(Math.round(1.04 * l.W + Math.max(18, 0.06 * l.H)));
  });

  it('keeps the centred book inside the solid band of the edge fade', () => {
    const l = shelfLayout(378, 470, 'books');
    const half = ((1.16 * l.W) / 2 / 378) * 100;
    expect(l.fadeStart).toBeLessThanOrEqual(50 - half);
    expect(l.fadeStart).toBeGreaterThanOrEqual(6);
  });
});

describe('bookTransform', () => {
  it('faces the centred book forward, lifted and enlarged', () => {
    const b = bookTransform(0, { H: 256, lite: false, flat: false });
    expect(b.dim).toBe(0);
    expect(b.z).toBe(1000);
    expect(b.transform).toContain('rotateY(0.00deg)');
    expect(b.transform).toContain('scale(1.1600)');
    expect(b.transform).toContain('rotateX(-6.00deg)');
  });

  it('turns a neighbour to show its spine or pages', () => {
    const b = bookTransform(1, { H: 256, lite: false, flat: false });
    expect(b.dim).toBe(0.5);
    expect(b.transform).toContain('rotateY(-35.4');
    expect(bookTransform(-1, { H: 256, lite: false, flat: false }).transform).toContain('rotateY(35.4');
  });

  it('caps how far books sink and darken', () => {
    const b = bookTransform(-5, { H: 256, lite: false, flat: false });
    expect(b.dim).toBe(0.6);
    expect(b.transform).toContain('-240.00px)');
  });

  it('keeps flat covers square to the screen', () => {
    const b = bookTransform(1, { H: 256, lite: false, flat: true });
    expect(b.transform).toContain('rotateY(0.00deg)');
    expect(b.transform).toContain('rotateX(0.00deg)');
  });

  it('turns less in lite mode', () => {
    expect(bookTransform(3, { H: 256, lite: true, flat: false }).transform).toMatch(/rotateY\(-1[78]\.\d\ddeg\)/);
  });
});

describe('visibleRange', () => {
  it('mounts only books near the viewport', () => {
    expect(visibleRange(0, 378, 102, 250, 2000)).toEqual([0, 5]);
    expect(visibleRange(250 * 1000, 378, 102, 250, 2000)).toEqual([996, 1005]);
  });

  it('stays inside the list', () => {
    expect(visibleRange(0, 378, 102, 250, 2)).toEqual([0, 1]);
    expect(visibleRange(0, 378, 102, 250, 0)).toEqual([0, -1]);
  });
});
