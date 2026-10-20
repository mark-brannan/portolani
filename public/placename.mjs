// A typed place name matched against a list of names, without case or accents, and loosely: a whole
// name, its start, one of its words, or a few letters' slip from one. Lower scores match better.
export const fold = (s) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function edits(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(row[j] + 1, next[j - 1] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    row = next;
  }
  return row[b.length];
}

export function nameScore(q, name) { // q already folded
  const n = fold(name), words = n.split(' ');
  if (n === q) return 0;
  if (n.startsWith(q)) return 1;
  if (words.some((w) => w.startsWith(q))) return 2;
  if (q.length < 4) return Infinity;
  const d = Math.min(edits(q, n), edits(q, n.slice(0, q.length)) + 0.25, ...words.map((w) => edits(q, w) + 0.5)); // the whole name before a part of it
  return d < Math.floor(q.length / 3) + 1 ? 3 + d : Infinity;
}

// The best of the candidates ({ name, ... }) for the text, or null; ties keep the earlier candidate.
export function bestPlace(text, candidates) {
  const q = fold(text);
  if (!q) return null;
  let best = null, bestScore = Infinity;
  for (const c of candidates) { const s = nameScore(q, c.name); if (s < bestScore) { best = c; bestScore = s; } }
  return best;
}
