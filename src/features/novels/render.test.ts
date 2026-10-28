import { openEpub } from './epub';
import { prepareCss, releaseSection, renderSection, ROOT_CLASS, sectionHeading } from './render';
import { makeEpub } from './testEpub';

beforeEach(() => {
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:test/${++n}`);
  URL.revokeObjectURL = vi.fn();
});

describe('prepareCss', () => {
  const imageUrl = (path: string) => (path === 'OEBPS/img/fig.png' ? 'blob:fig' : null);

  it('points book images into the book and drops everything else', () => {
    const css = prepareCss('a{background:url(../img/fig.png)} b{background:url("https://x/y.png")} c{background:url(missing.png)} d{fill:url(#g)}', 'OEBPS/css/b.css', imageUrl);
    expect(css).toBe('a{background:url("blob:fig")} b{background:none} c{background:none} d{fill:url(#g)}');
  });

  it('drops @import and @font-face', () => {
    expect(prepareCss('@import url(x.css); @font-face { font-family: X; src: url(x.ttf); } p{color:red}', 'a.css', imageUrl).trim()).toBe('p{color:red}');
  });

  it('moves html and body selectors onto the reading root', () => {
    expect(prepareCss('html, body { margin: 0 } body.x p { color: red } .body { top: 0 } tbody td { x: y }', 'a.css', imageUrl)).toBe(
      `.${ROOT_CLASS}, .${ROOT_CLASS} { margin: 0 } .${ROOT_CLASS}.x p { color: red } .body { top: 0 } tbody td { x: y }`,
    );
  });
});

describe('renderSection', () => {
  const book = openEpub(makeEpub());

  it('keeps the text and removes scripts', () => {
    const { body } = renderSection(book, 0);
    expect(body.textContent).toContain('First paragraph.');
    expect(body.querySelector('script')).toBeNull();
    expect(sectionHeading(renderSection(book, 1))).toBe('Two');
  });

  it('collects the linked stylesheet with its images resolved', () => {
    const { css } = renderSection(book, 0);
    expect(css).toContain('text-indent: 1em');
    expect(css).toContain(`.${ROOT_CLASS} { color: red; background: url("blob:test/`);
  });

  it('points images at the book and counts the object URLs', () => {
    const section = renderSection(book, 0);
    expect(section.body.querySelector('img')?.getAttribute('src')).toMatch(/^blob:test\//);
    expect(section.urls.length).toBeGreaterThan(0);
    releaseSection(section);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(section.urls.length);
  });

  it('turns links into reader links with resolved targets, and opens web links in a new tab', () => {
    const links = [...renderSection(book, 0).body.querySelectorAll('a')];
    expect(links[0]!.getAttribute('href')).toBeNull();
    expect(links[0]!.getAttribute('data-path')).toBe('OEBPS/text/c2.xhtml');
    expect(links[0]!.getAttribute('data-fragment')).toBe('start');
    expect(links[1]!.getAttribute('href')).toBe('https://example.com/x');
    expect(links[1]!.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('removes images and handlers that would load from elsewhere', () => {
    const xml = `<html xmlns="http://www.w3.org/1999/xhtml"><body onload="x()"><img src="https://t.example/p.gif"/><p onclick="y()" style="background:url(http://t.example/b.png)">hi</p></body></html>`;
    const custom = openEpub(makeEpub());
    const original = custom.text;
    custom.text = (path) => (path === 'OEBPS/text/c1.xhtml' ? xml : original(path));
    const { body } = renderSection(custom, 0);
    expect(body.querySelector('img')).toBeNull();
    expect(body.hasAttribute('onload')).toBe(false);
    const p = body.querySelector('p')!;
    expect(p.hasAttribute('onclick')).toBe(false);
    expect(p.getAttribute('style')).toBe('background:none');
  });

  it('falls back to the forgiving parser for markup that is not well-formed', () => {
    const custom = openEpub(makeEpub());
    custom.text = () => '<html><body><p>Unclosed <br>text<p>Next</body></html>';
    expect(renderSection(custom, 0).body.textContent).toContain('Next');
  });
});
