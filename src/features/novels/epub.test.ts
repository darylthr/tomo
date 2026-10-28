import { strToU8, zipSync } from 'fflate';
import { EpubError, openEpub, resolvePath, spineIndexOf } from './epub';
import { makeEpub } from './testEpub';

describe('resolvePath', () => {
  it('resolves relative references and decodes them', () => {
    expect(resolvePath('OEBPS/text/c1.xhtml', '../img/a%20b.png')).toBe('OEBPS/img/a b.png');
    expect(resolvePath('OEBPS/text/c1.xhtml', 'c2.xhtml#x')).toBe('OEBPS/text/c2.xhtml');
    expect(resolvePath('OEBPS/content.opf', '/abs/file.xhtml')).toBe('abs/file.xhtml');
    expect(resolvePath('content.opf', './c.xhtml')).toBe('c.xhtml');
  });
});

describe('openEpub', () => {
  it('reads the metadata, the spine and the cover', () => {
    const book = openEpub(makeEpub());
    expect(book).toMatchObject({ title: 'The Test Book', author: 'A. Writer', language: 'en', coverPath: 'OEBPS/img/cover.png' });
    expect(book.spine.map((s) => s.path)).toEqual(['OEBPS/text/c1.xhtml', 'OEBPS/text/c2.xhtml', 'OEBPS/text/c3.xhtml']);
    expect(book.spine.map((s) => s.linear)).toEqual([true, true, false]);
    expect(book.bytes('OEBPS/img/cover.png')?.length).toBe(16);
  });

  it('reads an EPUB 3 nav document as a nested contents list', () => {
    expect(openEpub(makeEpub()).toc).toEqual([
      { label: 'One', path: 'OEBPS/text/c1.xhtml', fragment: '', depth: 0 },
      { label: 'Middle', path: 'OEBPS/text/c1.xhtml', fragment: 'mid', depth: 1 },
      { label: 'Two', path: 'OEBPS/text/c2.xhtml', fragment: '', depth: 0 },
    ]);
  });

  it('reads an EPUB 2 NCX, and finds the cover from the meta tag', () => {
    const book = openEpub(makeEpub({ nav: false, ncx: true }));
    expect(book.toc.map((t) => [t.label, t.depth])).toEqual([
      ['One', 0],
      ['Middle', 1],
      ['Two', 0],
    ]);
    expect(book.coverPath).toBe('OEBPS/img/cover.png');
  });

  it('copes with a book that has no contents list', () => {
    expect(openEpub(makeEpub({ nav: false })).toc).toEqual([]);
  });

  it('finds the spine item for a contents entry', () => {
    const book = openEpub(makeEpub());
    expect(spineIndexOf(book, 'OEBPS/text/c2.xhtml')).toBe(1);
    expect(spineIndexOf(book, 'nope.xhtml')).toBe(-1);
  });

  it('rejects files that are not EPUBs', () => {
    expect(() => openEpub(strToU8('not a zip'))).toThrow(EpubError);
    expect(() => openEpub(zipSync({ 'hello.txt': strToU8('hi') }))).toThrow(/not an EPUB/);
    const noSpine = zipSync({
      'META-INF/container.xml': strToU8('<container><rootfiles><rootfile full-path="c.opf"/></rootfiles></container>'),
      'c.opf': strToU8('<package><metadata/><manifest/><spine/></package>'),
    });
    expect(() => openEpub(noSpine)).toThrow(/no readable pages/);
  });
});
