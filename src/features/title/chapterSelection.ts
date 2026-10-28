/** Chapter ids from `a` to `b` inclusive, in the order the list shows them (either way round). */
export function idsBetween(order: readonly number[], a: number, b: number): number[] {
  const from = order.indexOf(a);
  const to = order.indexOf(b);
  if (from < 0 || to < 0) return [];
  return order.slice(Math.min(from, to), Math.max(from, to) + 1);
}

/** The selection with every chapter between its first and last picked rows added. */
export function fillRange(order: readonly number[], selected: ReadonlySet<number>): Set<number> {
  const rows = order.map((id, i) => (selected.has(id) ? i : -1)).filter((i) => i >= 0);
  if (rows.length < 2) return new Set(selected);
  return new Set([...selected, ...order.slice(rows[0]!, rows[rows.length - 1]! + 1)]);
}
