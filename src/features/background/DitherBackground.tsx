import { useEffect, useRef, useState } from 'react';
import { useSettings } from '../../shared/settings/store';
import { loadBackgroundImage } from './backgroundImage';
import { coverRect, ditherPixels } from './dither';
import { createGlRenderer, type GlRenderer } from './glRenderer';
import styles from './DitherBackground.module.css';

type Mode = 'gl' | 'cpu';

function renderCpu(canvas: HTMLCanvasElement, img: ImageBitmap, levels: number): void {
  const { width: w, height: h } = canvas;
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext('2d', { willReadFrequently: true });
  const ctx = canvas.getContext('2d');
  if (!sctx || !ctx) return;
  const { sx, sy, sw, sh } = coverRect(img.width, img.height, w, h);
  sctx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  const src = sctx.getImageData(0, 0, w, h).data;
  const out = ctx.createImageData(w, h);
  out.data.set(ditherPixels(src, w, h, { levels }));
  ctx.putImageData(out, 0, 0);
}

/**
 * The dithered background, drawn inside its positioned parent (the frame panel).
 * Renders only when the image, settings or panel size change.
 */
export function DitherBackground() {
  const { enabled, imageKey, levels, cell } = useSettings((s) => s.settings.background);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState<{ key: string; bitmap: ImageBitmap | null } | null>(null);
  const [mode, setMode] = useState<Mode>('gl');
  const active = enabled && imageKey !== null;
  const img = active && loaded?.key === imageKey ? loaded.bitmap : null;

  useEffect(() => {
    if (!active || !imageKey) return;
    let cancelled = false;
    loadBackgroundImage(imageKey).then((bitmap) => {
      if (!cancelled) setLoaded({ key: imageKey, bitmap });
    });
    return () => {
      cancelled = true;
    };
  }, [active, imageKey]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    let gl: GlRenderer | null = null;
    let frame = 0;

    const draw = () => {
      frame = 0;
      if (mode === 'gl' && !gl) {
        gl = createGlRenderer(canvas);
        if (!gl) {
          // GL may have claimed this canvas before failing (shader compile, lost at creation),
          // and a claimed canvas can't give a 2D context: fall back on a fresh element.
          setMode('cpu');
          return;
        }
        gl.onContextLost(() => setMode('cpu'));
      }
      const host = canvas.parentElement ?? canvas;
      const rect = host.getBoundingClientRect();
      canvas.width = Math.max(1, Math.ceil(rect.width / cell));
      canvas.height = Math.max(1, Math.ceil(rect.height / cell));
      if (gl) gl.render(img, { levels });
      else renderCpu(canvas, img, levels);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(draw);
    };

    schedule();
    const observer = new ResizeObserver(schedule);
    if (canvas.parentElement) observer.observe(canvas.parentElement);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      gl?.dispose();
    };
  }, [img, levels, cell, mode]);

  if (!active) return null;
  // A lost WebGL canvas can't switch to 2D, so the CPU path gets a fresh element.
  return <canvas key={mode} ref={canvasRef} className={styles.bg} aria-hidden="true" />;
}
