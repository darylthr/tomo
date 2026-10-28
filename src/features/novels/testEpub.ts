import { strToU8, zipSync } from 'fflate';

const CONTAINER = `<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;

const chapter = (title: string, body: string) =>
  `<?xml version="1.0" encoding="utf-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${title}</title><link rel="stylesheet" href="../css/book.css"/><script>alert(1)</script></head><body><h1 id="top">${title}</h1>${body}</body></html>`;

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);

export type TestEpubOptions = { nav?: boolean; ncx?: boolean; title?: string; /** Extra paragraphs in chapter one, so it spans several pages. */ filler?: number };

/** A small, valid EPUB 3 (nav) or EPUB 2 (NCX) for tests: a cover, three chapters, an image and a stylesheet. */
export function makeEpub({ nav = true, ncx = false, title = 'The Test Book', filler = 0 }: TestEpubOptions = {}): Uint8Array {
  const items = [
    `<item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="c3" href="text/c3.xhtml" media-type="application/xhtml+xml"/>`,
    `<item id="css" href="css/book.css" media-type="text/css"/>`,
    `<item id="cover" href="img/cover.png" media-type="image/png" ${nav ? 'properties="cover-image"' : ''}/>`,
    `<item id="fig" href="img/fig.png" media-type="image/png"/>`,
    nav ? `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>` : '',
    ncx ? `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>` : '',
  ].join('');
  const opf = `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="${nav ? '3.0' : '2.0'}" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${title}</dc:title><dc:creator>A. Writer</dc:creator><dc:language>en</dc:language>${nav ? '' : '<meta name="cover" content="cover"/>'}</metadata><manifest>${items}</manifest><spine${ncx ? ' toc="ncx"' : ''}><itemref idref="c1"/><itemref idref="c2"/><itemref idref="c3" linear="no"/></spine></package>`;
  const files: Record<string, Uint8Array> = {
    mimetype: strToU8('application/epub+zip'),
    'META-INF/container.xml': strToU8(CONTAINER),
    'OEBPS/content.opf': strToU8(opf),
    'OEBPS/css/book.css': strToU8('body { color: red; background: url(../img/fig.png); } p { text-indent: 1em; }'),
    'OEBPS/img/cover.png': PNG,
    'OEBPS/img/fig.png': PNG,
    'OEBPS/text/c1.xhtml': strToU8(chapter('One', `<p>First paragraph.</p>${Array.from({ length: filler }, (_, i) => `<p>Filler paragraph ${i + 1}. The quick brown fox jumps over the lazy dog, then thinks about it for a while before going home to rest.</p>`).join('')}<p id="mid">Middle.</p><img src="../img/fig.png" alt="figure"/><a href="c2.xhtml#start">next</a><a href="https://example.com/x">web</a>`)),
    'OEBPS/text/c2.xhtml': strToU8(chapter('Two', '<p id="start">Second chapter.</p>')),
    'OEBPS/text/c3.xhtml': strToU8(chapter('Three', '<p>Third chapter.</p>')),
  };
  if (nav)
    files['OEBPS/nav.xhtml'] = strToU8(
      `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="text/c1.xhtml">One</a><ol><li><a href="text/c1.xhtml#mid">Middle</a></li></ol></li><li><a href="text/c2.xhtml">Two</a></li></ol></nav></body></html>`,
    );
  if (ncx)
    files['OEBPS/toc.ncx'] = strToU8(
      `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint id="a"><navLabel><text>One</text></navLabel><content src="text/c1.xhtml"/><navPoint id="b"><navLabel><text>Middle</text></navLabel><content src="text/c1.xhtml#mid"/></navPoint></navPoint><navPoint id="c"><navLabel><text>Two</text></navLabel><content src="text/c2.xhtml"/></navPoint></navMap></ncx>`,
    );
  return zipSync(files);
}
