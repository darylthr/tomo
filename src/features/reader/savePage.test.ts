import { pageFileName, savePage } from './savePage';

const blob = new Blob(['x'], { type: 'image/webp' });

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(blob, { headers: { 'content-type': 'image/webp' } })));
  URL.createObjectURL = vi.fn(() => 'blob:page');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'canShare');
  Reflect.deleteProperty(navigator, 'share');
});

it('names the file after the title, chapter and page', () => {
  expect(pageFileName('Blue: Hour?', 12, 7, 'image/webp')).toBe('Blue Hour - Ch 12 - p8.webp');
  expect(pageFileName('Night Tram', 3, 0, 'image/png')).toBe('Night Tram - Ch 3 - p1.png');
  expect(pageFileName('Kintsugi', 1, 1, 'application/octet-stream')).toBe('Kintsugi - Ch 1 - p2.jpg');
});

it('shares the image where the device can share files', async () => {
  const share = vi.fn(async () => {});
  Object.assign(navigator, { canShare: () => true, share });
  await expect(savePage('/p/1', (type) => `page.${type.split('/')[1]}`)).resolves.toBe('shared');
  const files = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files;
  expect(files[0]!.name).toBe('page.webp');
});

it('downloads elsewhere', async () => {
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await expect(savePage('/p/1', () => 'page.webp')).resolves.toBe('downloaded');
  const a = click.mock.instances[0] as unknown as HTMLAnchorElement;
  expect(a.download).toBe('page.webp');
  expect(a.href).toBe('blob:page');
  click.mockRestore();
});

it('treats a cancelled share sheet as no error', async () => {
  Object.assign(navigator, { canShare: () => true, share: vi.fn(async () => Promise.reject(new DOMException('cancel', 'AbortError'))) });
  await expect(savePage('/p/1', () => 'page.webp')).resolves.toBe('cancelled');
});

it('fails when the page cannot be fetched', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 502 })));
  await expect(savePage('/p/1', () => 'page.webp')).rejects.toThrow();
});
