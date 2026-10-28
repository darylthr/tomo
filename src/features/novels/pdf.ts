import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export class PdfError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PdfError';
  }
}

export type PdfBook = {
  doc: PDFDocumentProxy;
  pages: number;
  title: string;
  author: string;
  /** Frees the document and its worker. */
  destroy: () => Promise<void>;
};

/** Opens a PDF. The bytes are copied, because pdf.js hands its input to a worker. */
export async function openPdf(data: ArrayBuffer): Promise<PdfBook> {
  const task = pdfjs.getDocument({ data: new Uint8Array(data.slice(0)) });
  let doc: PDFDocumentProxy;
  try {
    doc = await task.promise;
  } catch (e) {
    void task.destroy();
    throw new PdfError(e instanceof Error && e.name === 'PasswordException' ? 'This PDF is locked with a password' : "This PDF can't be read");
  }
  const meta = await doc.getMetadata().catch(() => null);
  const info = (meta?.info ?? {}) as { Title?: unknown; Author?: unknown };
  const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  return { doc, pages: doc.numPages, title: text(info.Title), author: text(info.Author), destroy: () => task.destroy() };
}

export type PageFit = 'screen' | 'width';

/** The CSS size a page is drawn at inside a box, for the fit chosen. */
export function fitSize(page: { width: number; height: number }, box: { width: number; height: number }, fit: PageFit): { width: number; height: number } {
  const scale = fit === 'width' ? box.width / page.width : Math.min(box.width / page.width, box.height / page.height);
  return { width: Math.floor(page.width * scale), height: Math.floor(page.height * scale) };
}

/** Pixel density to draw at: the screen's, but no more than 2, which keeps big pages affordable. */
export const pixelRatio = () => Math.min(2, window.devicePixelRatio || 1);

/**
 * Draws page `number` (1-based) into `canvas` so it covers `cssWidth` CSS pixels.
 * Returns a handle that cancels the drawing; the promise settles false when it was cancelled.
 */
export function renderPage(book: PdfBook, number: number, canvas: HTMLCanvasElement, cssWidth: number): { done: Promise<boolean>; cancel: () => void } {
  let task: RenderTask | null = null;
  let cancelled = false;
  const done = (async () => {
    const page = await book.doc.getPage(number);
    if (cancelled) return false;
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: (cssWidth / base.width) * pixelRatio() });
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    task = page.render({ canvas, viewport });
    try {
      await task.promise;
      return true;
    } catch (e) {
      if (cancelled || (e instanceof Error && e.name === 'RenderingCancelledException')) return false;
      throw e;
    }
  })();
  return {
    done,
    cancel: () => {
      cancelled = true;
      task?.cancel();
    },
  };
}

/** The first page as a JPEG, for the shelf. */
export async function coverOf(book: PdfBook, width = 420): Promise<{ bytes: ArrayBuffer; type: string } | null> {
  const canvas = document.createElement('canvas');
  try {
    const ok = await renderPage(book, 1, canvas, width / pixelRatio()).done;
    if (!ok) return null;
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ? { bytes: await blob.arrayBuffer(), type: 'image/jpeg' } : null;
  } catch {
    return null;
  }
}

/** The page's size in PDF units, for laying out before it is drawn. */
export async function pageSize(book: PdfBook, number: number): Promise<{ width: number; height: number }> {
  const page = await book.doc.getPage(number);
  const { width, height } = page.getViewport({ scale: 1 });
  return { width, height };
}
