import { render, waitFor } from '@testing-library/react';
import { useSettings } from '../../shared/settings/store';
import { ditherPixels } from './dither';

const lost: (() => void)[] = [];
const glRender = vi.fn();

vi.mock('./dither', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./dither')>();
  return { ...actual, ditherPixels: vi.fn(actual.ditherPixels) };
});
const spy = vi.mocked(ditherPixels);

vi.mock('./backgroundImage', () => ({
  loadBackgroundImage: vi.fn(async () => ({ width: 1600, height: 1000, close() {} })),
}));

vi.mock('./glRenderer', () => ({
  createGlRenderer: vi.fn(() => null),
}));

const fake2d = {
  drawImage: vi.fn(),
  getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })),
  createImageData: vi.fn((w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) })),
  putImageData: vi.fn(),
};

beforeEach(() => {
  spy.mockClear();
  lost.length = 0;
  glRender.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((type: string) =>
    type === '2d' ? fake2d : null) as typeof HTMLCanvasElement.prototype.getContext);
  useSettings.getState().reset();
});

afterEach(() => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockRestore();
});

async function renderBackground() {
  const { DitherBackground } = await import('./DitherBackground');
  return render(
    <div style={{ position: 'relative', width: 400, height: 800 }}>
      <DitherBackground />
    </div>,
  );
}

it('draws nothing while the background is off', async () => {
  const { container } = await renderBackground();
  expect(container.querySelector('canvas')).toBeNull();
});

it('falls back to the CPU path when WebGL2 is unavailable', async () => {
  useSettings.getState().update({ background: { enabled: true, imageKey: 'background' } });
  const { container } = await renderBackground();
  await waitFor(() => expect(spy).toHaveBeenCalled());
  expect(container.querySelector('canvas')).not.toBeNull();
});

it('draws on the CPU when GL setup fails after it already claimed the canvas', async () => {
  // Like a browser: once a canvas has a webgl2 context it can never give a 2d one.
  const claimed = new WeakSet<HTMLCanvasElement>();
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(function (this: HTMLCanvasElement, type: string) {
    if (type === 'webgl2') {
      claimed.add(this);
      return null;
    }
    return claimed.has(this) ? null : fake2d;
  } as typeof HTMLCanvasElement.prototype.getContext);
  const gl = await import('./glRenderer');
  vi.mocked(gl.createGlRenderer).mockImplementation((canvas) => {
    canvas.getContext('webgl2'); // got a context, then shader compile failed
    return null;
  });
  fake2d.putImageData.mockClear();
  useSettings.getState().update({ background: { enabled: true, imageKey: 'background' } });
  await renderBackground();
  await waitFor(() => expect(fake2d.putImageData).toHaveBeenCalled());
});

it('switches to the CPU path after the GL context is lost', async () => {
  const gl = await import('./glRenderer');
  vi.mocked(gl.createGlRenderer).mockImplementation(() => ({
    render: glRender,
    onContextLost: (cb: () => void) => lost.push(cb),
    dispose: vi.fn(),
  }));
  useSettings.getState().update({ background: { enabled: true, imageKey: 'background' } });
  const { container } = await renderBackground();
  await waitFor(() => expect(glRender).toHaveBeenCalled());
  expect(spy).not.toHaveBeenCalled();
  lost.forEach((cb) => cb());
  await waitFor(() => expect(spy).toHaveBeenCalled());
  expect(container.querySelector('canvas')).not.toBeNull();
});
