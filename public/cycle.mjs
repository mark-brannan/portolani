// A shuffled order that is the same on every load, so pressing "next" again and again comes round every name once
// before any repeats. Each name's place is set by a hash of it alone, so a name added later slots in and the rest keep theirs.
const hash = (s) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.codePointAt(0), 16777619); return h >>> 0; };
export const cycleOrder = (names, seed = 'portolani') =>
  [...new Set(names)].sort((a, b) => hash(seed + a) - hash(seed + b) || (a < b ? -1 : 1));
// the name after `last` in that order, the first where `last` is none or gone; null for no names
export function nextInCycle(names, last, seed) {
  const order = cycleOrder(names, seed);
  return order.length ? order[(order.indexOf(last) + 1) % order.length] : null;
}
