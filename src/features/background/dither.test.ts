import { BAYER8, coverRect, ditherPixels, fadeAt, quantize, tone } from './dither';

function solid(w: number, h: number, v: number): Uint8ClampedArray {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i += 4) px.set([v, v, v, 255], i);
  return px;
}

describe('BAYER8', () => {
  it('holds 64 distinct thresholds between 0.5/64 and 63.5/64', () => {
    expect(BAYER8).toHaveLength(64);
    expect(new Set(BAYER8).size).toBe(64);
    expect(Math.min(...BAYER8)).toBeCloseTo(0.5 / 64);
    expect(Math.max(...BAYER8)).toBeCloseTo(63.5 / 64);
  });
});

describe('fadeAt', () => {
  it('holds full strength through the top fifth', () => {
    expect(fadeAt(0)).toBeCloseTo(0.5);
    expect(fadeAt(0.2)).toBeCloseTo(0.5);
  });

  it('matches the Capy curve mid-panel', () => {
    expect(fadeAt(0.5)).toBeCloseTo(0.2137, 3);
  });

  it('is pure black from 88% down', () => {
    expect(fadeAt(0.88)).toBe(0);
    expect(fadeAt(1)).toBe(0);
  });
});

describe('tone', () => {
  it('applies the 1.2 power curve', () => {
    expect(tone(0)).toBe(0);
    expect(tone(255)).toBe(1);
    expect(tone(128)).toBeCloseTo((128 / 255) ** 1.2);
  });
});

describe('quantize', () => {
  it('snaps to evenly spaced levels', () => {
    expect(quantize(0, 0.5, 6)).toBe(0);
    expect(quantize(1, 0.5, 6)).toBe(255);
    expect([0, 51, 102, 153, 204, 255]).toContain(quantize(0.37, 0.2, 6));
  });
});

describe('ditherPixels', () => {
  it('mixes the two nearest levels in proportion to the remainder', () => {
    // tone(234) * fade 0.5 * 5 steps ≈ 2.255 → 25% of a Bayer tile at level 3, 75% at level 2
    const out = ditherPixels(solid(8, 100, 234), 8, 100, { levels: 6 });
    const tile = Array.from({ length: 64 }, (_, i) => out[i * 4]!);
    expect(tile.filter((v) => v === 153)).toHaveLength(16);
    expect(tile.filter((v) => v === 102)).toHaveLength(48);
  });

  it('keeps each channel separately, so colors survive', () => {
    const px = new Uint8ClampedArray([255, 0, 0, 255]);
    const out = ditherPixels(px, 1, 100, { levels: 6 });
    expect(out[0]).toBeGreaterThan(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(0);
  });

  it('renders the bottom row pure black', () => {
    const h = 20;
    const out = ditherPixels(solid(4, h, 255), 4, h, { levels: 6 });
    const last = out.subarray((h - 1) * 4 * 4);
    for (let i = 0; i < last.length; i += 4) expect([last[i], last[i + 1], last[i + 2], last[i + 3]]).toEqual([0, 0, 0, 255]);
  });
});

describe('coverRect', () => {
  it('crops the source like object-fit: cover', () => {
    expect(coverRect(1600, 1000, 400, 800)).toEqual({ sx: 550, sy: 0, sw: 500, sh: 1000 });
    expect(coverRect(1000, 1600, 800, 400)).toEqual({ sx: 0, sy: 550, sw: 1000, sh: 500 });
  });
});
