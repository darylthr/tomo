const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

/** "<Title> - Ch <n> - p<page>.<ext>", with characters files can't hold taken out of the title. */
export function pageFileName(title: string, chapterNumber: number, page: number, contentType: string): string {
  const safe = title.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  const ext = EXTENSIONS[contentType.split(';')[0]!.trim()] ?? 'jpg';
  return `${safe} - Ch ${chapterNumber} - p${page + 1}.${ext}`;
}

/**
 * Saves a page image: the share sheet where the device can share files (iPhone, tablet), so it can
 * go to Photos or a message; a download elsewhere. Cancelling the share sheet isn't an error.
 */
export async function savePage(url: string, fileName: (contentType: string) => string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const type = blob.type || res.headers.get('content-type') || 'image/jpeg';
  const file = new File([blob], fileName(type), { type });

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      throw e;
    }
  }

  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
  return 'downloaded';
}
