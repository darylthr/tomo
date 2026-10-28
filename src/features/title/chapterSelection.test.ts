import { fillRange, idsBetween } from './chapterSelection';

const order = [30, 20, 10, 5, 1];

describe('idsBetween', () => {
  it('takes both ends and everything between, whichever end comes first', () => {
    expect(idsBetween(order, 20, 5)).toEqual([20, 10, 5]);
    expect(idsBetween(order, 5, 20)).toEqual([20, 10, 5]);
  });

  it('is one chapter when both ends are the same', () => {
    expect(idsBetween(order, 10, 10)).toEqual([10]);
  });

  it('is empty when a chapter is not in the list (filtered out)', () => {
    expect(idsBetween(order, 20, 99)).toEqual([]);
  });
});

describe('fillRange', () => {
  it('fills the gap between the first and last picked rows', () => {
    expect([...fillRange(order, new Set([30, 5]))].sort((a, b) => a - b)).toEqual([5, 10, 20, 30]);
  });

  it('leaves one or no picked row alone', () => {
    expect([...fillRange(order, new Set([10]))]).toEqual([10]);
    expect(fillRange(order, new Set()).size).toBe(0);
  });
});
