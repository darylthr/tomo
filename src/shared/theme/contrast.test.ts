import { contrastRatio, meetsAA } from './contrast';

describe('contrastRatio', () => {
  it('is 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('matches the WCAG value for #777 on white', () => {
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });

  it('accepts short hex', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 1);
  });
});

describe('meetsAA', () => {
  it('fails normal text at 4.48', () => {
    expect(meetsAA('#777777', '#ffffff')).toBe(false);
  });

  it('passes large text at 4.48', () => {
    expect(meetsAA('#777777', '#ffffff', true)).toBe(true);
  });
});
