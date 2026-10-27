import { clampPan, fitContent, IDENTITY, overscroll, zoomAt } from './zoomMath';

const box = { w: 400, h: 800 };
const content = { w: 400, h: 600 };

it('zooms about a point and keeps it under the fingers', () => {
  expect(zoomAt(IDENTITY, 2, 100, 50, 4)).toEqual({ scale: 2, x: -100, y: -50 });
});

it('clamps scale between 1 and the maximum', () => {
  expect(zoomAt(IDENTITY, 10, 0, 0, 4).scale).toBe(4);
  expect(zoomAt({ scale: 2, x: 5, y: 5 }, 0.1, 0, 0, 4)).toEqual(IDENTITY);
});

it('keeps the page edge from leaving the screen', () => {
  // scaled 800×1200 in a 400×800 box: 200px of overhang on each side, either way
  expect(clampPan({ scale: 2, x: 500, y: 0 }, box, content)).toEqual({ scale: 2, x: 200, y: 0 });
  expect(clampPan({ scale: 2, x: -500, y: -900 }, box, content)).toEqual({ scale: 2, x: -200, y: -200 });
  // content smaller than the box on an axis stays centred there
  expect(clampPan({ scale: 1.2, x: 30, y: 30 }, box, content).y).toBe(0);
});

it('reports how far a pan pushed past the edge', () => {
  expect(overscroll({ scale: 2, x: 0, y: 0 }, { x: -260, y: 10 }, box, content)).toEqual({ x: -60, y: 0 });
});

describe('fitted content size', () => {
  it('fits one page into the screen', () => {
    expect(fitContent({ w: 1280, h: 800 }, [0.7], 'screen')).toEqual({ w: 560, h: 800 });
  });

  it('measures a spread as both pages side by side', () => {
    // each page may take half the width; at 0.7 the height limits it to 560px wide
    expect(fitContent({ w: 1280, h: 800 }, [0.7, 0.7], 'screen')).toEqual({ w: 1120, h: 800 });
    // narrow screen: each page capped at half the width
    expect(fitContent({ w: 600, h: 800 }, [0.7, 0.7], 'screen')).toEqual({ w: 600, h: 300 / 0.7 });
  });

  it('falls back to the box when sizes are unknown', () => {
    expect(fitContent({ w: 1000, h: 1000 }, [], 'screen')).toEqual({ w: 1000, h: 1000 });
  });
});
