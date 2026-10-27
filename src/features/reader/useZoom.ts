import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type RefObject } from 'react';
import { prefersReducedMotion } from '../../shared/ui/useReducedMotion';
import { clampPan, IDENTITY, overscroll, zoomAt, type Zoom } from './zoomMath';

type Size = { w: number; h: number };

type Options = {
  /** The element gestures happen on; wheel and Safari gesture events are caught here. */
  ref: RefObject<HTMLElement | null>;
  max: number;
  /** Double-tap goes to this scale. */
  doubleTap: number;
  /** The box and the content's size at 1×, measured when a gesture starts. */
  measure: () => { box: Size; content: Size };
  /** A pan pushed this far past the edge (screen px, signed on the reading axis) turns the page. */
  onEdgeTurn: (dx: number, dy: number) => void;
  /** Zoom resets whenever this changes (the page on screen). */
  resetKey: unknown;
};

const EDGE_TURN_PX = 80;
const KEY_STEP = 0.5;

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/** Pinch, pan with momentum, Ctrl/⌘ + wheel and + / − / 0 zoom for the paged reader. */
export function useZoom({ ref, max, doubleTap, measure, onEdgeTurn, resetKey }: Options) {
  // Zoom belongs to the page it was made on: a new resetKey reads as 1× without an effect.
  const [state, setState] = useState({ key: resetKey, zoom: IDENTITY });
  const zoom = state.key === resetKey ? state.zoom : IDENTITY;
  const [gesturing, setGesturing] = useState(false);
  const keyRef = useRef(resetKey);
  const live = useRef(state);
  const current = () => (live.current.key === keyRef.current ? live.current.zoom : IDENTITY);
  const setZoom = (z: Zoom) => {
    live.current = { key: keyRef.current, zoom: z };
    setState(live.current);
  };
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pan = useRef<{ x: number; y: number; zx: number; zy: number; over: { x: number; y: number }; turned: boolean } | null>(null);
  const pinch = useRef<{ dist: number; mid: { x: number; y: number } } | null>(null);
  const velocity = useRef({ x: 0, y: 0, t: 0 });
  const frame = useRef(0);

  const centre = (clientX: number, clientY: number) => {
    const r = ref.current?.getBoundingClientRect();
    return r ? { x: clientX - r.left - r.width / 2, y: clientY - r.top - r.height / 2 } : { x: 0, y: 0 };
  };
  const settle = (z: Zoom) => {
    const { box, content } = measure();
    return z.scale === 1 ? IDENTITY : clampPan(z, box, content);
  };
  const zoomBy = (factor: number, cx: number, cy: number) => setZoom(settle(zoomAt(current(), factor, cx, cy, max)));

  useEffect(() => {
    keyRef.current = resetKey;
    cancelAnimationFrame(frame.current);
  }, [resetKey]);

  // Ctrl/⌘ + wheel (also what a trackpad pinch sends) and Safari's own pinch, both kept from zooming the app.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const c = centre(e.clientX, e.clientY);
      zoomBy(Math.exp(-e.deltaY * 0.01), c.x, c.y);
    };
    const stop = (e: Event) => e.preventDefault();
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', stop);
    el.addEventListener('gesturechange', stop);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', stop);
      el.removeEventListener('gesturechange', stop);
    };
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === '+' || e.key === '=') zoomBy((current().scale + KEY_STEP) / current().scale, 0, 0);
      else if (e.key === '-') zoomBy((current().scale - KEY_STEP) / current().scale, 0, 0);
      else if (e.key === '0') setZoom(IDENTITY);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const glide = () => {
    const v = velocity.current;
    if (prefersReducedMotion() || Math.hypot(v.x, v.y) < 0.5) return;
    const step = () => {
      v.x *= 0.95;
      v.y *= 0.95;
      const z = current();
      setZoom(settle({ ...z, x: z.x + v.x, y: z.y + v.y }));
      if (Math.hypot(v.x, v.y) >= 0.5) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
  };

  const onPointerDown = (e: PointerEvent) => {
    cancelAnimationFrame(frame.current);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: centre((a.x + b.x) / 2, (a.y + b.y) / 2) };
      pan.current = null;
      setGesturing(true);
    } else if (pts.length === 1 && current().scale > 1) {
      const z = current();
      pan.current = { x: e.clientX, y: e.clientY, zx: z.x, zy: z.y, over: { x: 0, y: 0 }, turned: false };
      velocity.current = { x: 0, y: 0, t: e.timeStamp };
      setGesturing(true);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    // A mouse let go outside the window sends no pointerup; its next move has no button held.
    if (e.pointerType === 'mouse' && e.buttons === 0) return onPointerUp(e);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pinch.current && pts.length >= 2) {
      const [a, b] = pts as [{ x: number; y: number }, { x: number; y: number }];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = centre((a.x + b.x) / 2, (a.y + b.y) / 2);
      const z = zoomAt(current(), dist / Math.max(1, pinch.current.dist), mid.x, mid.y, max);
      const moved = { ...z, x: z.x + mid.x - pinch.current.mid.x, y: z.y + mid.y - pinch.current.mid.y };
      pinch.current = { dist, mid };
      setZoom(settle(moved));
      return;
    }
    const p = pan.current;
    if (!p) return;
    const wanted = { x: p.zx + e.clientX - p.x, y: p.zy + e.clientY - p.y };
    const { box, content } = measure();
    const z = { ...current(), ...wanted };
    p.over = overscroll(z, wanted, box, content);
    const dt = Math.max(1, e.timeStamp - velocity.current.t);
    velocity.current = { x: ((e.clientX - prev.x) / dt) * 16, y: ((e.clientY - prev.y) / dt) * 16, t: e.timeStamp };
    setZoom(clampPan(z, box, content));
  };

  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    const p = pan.current;
    if (p && pointers.current.size === 0) {
      pan.current = null;
      if (!p.turned && (Math.abs(p.over.x) > EDGE_TURN_PX || Math.abs(p.over.y) > EDGE_TURN_PX)) {
        p.turned = true;
        onEdgeTurn(p.over.x, p.over.y);
      } else glide();
    }
    if (pointers.current.size === 0) setGesturing(false);
  };

  const zoomed = zoom.scale > 1;
  const animate = !gesturing && !prefersReducedMotion();
  const style: CSSProperties = {
    transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})`,
    transition: animate ? 'transform 200ms var(--ease)' : 'none',
  };

  /** Double-tap: zoom in about the point, or back out. Coordinates are client pixels. */
  const toggleAt = (clientX: number, clientY: number) => {
    if (current().scale > 1) return setZoom(IDENTITY);
    const c = centre(clientX, clientY);
    setZoom(settle(zoomAt(IDENTITY, doubleTap, c.x, c.y, max)));
  };

  return {
    zoom,
    zoomed,
    style,
    toggleAt,
    /** True while a finger is down on a zoom gesture: the view's own swipe handling should stand aside. */
    isGesturing: () => pan.current !== null || pinch.current !== null || pointers.current.size > 1,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp },
  };
}
