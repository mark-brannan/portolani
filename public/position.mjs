// A typed position, latitude then longitude, read from one string. Each half is decimal degrees, degrees and
// decimal minutes, or degrees, minutes and seconds; the marks are ° ' " (or ′ ″, or the letters d m s), a
// hemisphere letter (N S E W, either case) stands before or after its number, or a sign does its work.
// Halves part at the one comma, semicolon or slash if there is exactly one, else at the hemisphere letters
// when each half has its own, else the numbers divide evenly (2, 4 or 6 of them). Anything else, or a value out of range, is null.
//
//   parsePosition('38° 30.5′ N 20° 15′ E')  ->  { lat: 38.50833…, lon: 20.25 }
//
// Two readings are by choice. A hemisphere letter wins over a minus sign (-38 S is 38 S). A lower-case "s"
// straight after a third number is the seconds mark (38d30m15s); anywhere else s is south.

const HEMI = { N: 1, S: -1, E: 1, W: -1 };
const MARK = { '°': 0, d: 0, "'": 1, m: 1, '"': 2, s: 2 }; // which part a mark closes: degrees, minutes, seconds

function lex(text) {
  const s = text.replace(/[º˚]/g, '°').replace(/[′‘’]/g, "'").replace(/[″“”]/g, '"').replace(/''/g, '"');
  const re = /\s+|([+-]?(?:\d+(?:\.\d*)?|\.\d+))|([°'"])|([A-Za-z])|([,;/])/y, out = [];
  let count = 0, spaced = true; // numbers since the last letter or separator; whether blank came just before
  for (let m; re.lastIndex < s.length;) {
    if (!(m = re.exec(s))) return null;
    if (m[1] !== undefined) { out.push({ t: 'num', sign: /^-/.test(m[1]) ? -1 : 1, v: m[1].replace(/^[+-]/, '') }); count++; spaced = false; }
    else if (m[2]) { out.push({ t: 'mark', k: MARK[m[2]] }); spaced = false; if (m[2] === '"') count = 0; }
    else if (m[3]) {
      const c = m[3];
      if (c === 's' && !spaced && out.at(-1)?.t === 'num' && count === 3) { out.push({ t: 'mark', k: 2 }); count = 0; }
      else if (/^[dm]$/i.test(c)) out.push({ t: 'mark', k: MARK[c.toLowerCase()] });
      else if (c.toUpperCase() in HEMI) { out.push({ t: 'hemi', c: c.toUpperCase() }); count = 0; }
      else return null;
      spaced = false;
    } else if (m[4]) { out.push({ t: 'sep' }); count = 0; spaced = false; }
    else spaced = true;
  }
  return out;
}

// One half: an optional hemisphere letter at either end, then 1 to 3 numbers, each with its own mark or none.
function coordinate(toks, letters, limit) {
  const hemis = toks.filter((t) => t.t === 'hemi');
  if (hemis.length > 1 || (hemis[0] && hemis[0] !== toks[0] && hemis[0] !== toks.at(-1)) || (hemis[0] && !letters.includes(hemis[0].c))) return null;
  const body = toks.filter((t) => t.t !== 'hemi'), parts = [];
  let sign = 1;
  for (let i = 0; i < body.length;) {
    const n = body[i++];
    if (n.t !== 'num' || parts.length === 3) return null;
    if (parts.length === 0) sign = n.sign; else if (n.sign < 0) return null;
    if (body[i]?.t === 'mark') { if (body[i++].k !== parts.length) return null; }
    parts.push(Number(n.v));
  }
  if (!parts.length || parts.slice(0, -1).some((x) => !Number.isInteger(x)) || parts.slice(1).some((x) => x >= 60)) return null;
  const abs = parts.reduce((sum, x, i) => sum + x / 60 ** i, 0);
  const v = hemis[0] ? abs * HEMI[hemis[0].c] : abs * sign; // a letter wins over a sign
  return Math.abs(v) <= limit ? v + 0 : null;
}

export function parsePosition(text) {
  const toks = lex(String(text));
  if (!toks?.length) return null;
  const seps = toks.filter((t) => t.t === 'sep');
  let halves;
  if (seps.length === 1) { const i = toks.indexOf(seps[0]); halves = [toks.slice(0, i), toks.slice(i + 1)]; }
  else {
    const body = toks.filter((t) => t.t !== 'sep'), at = body.flatMap((t, i) => (t.t === 'hemi' ? [i] : []));
    const lone = at.length === 0 || (at.length === 1 && (at[0] === 0 || at[0] === body.length - 1)); // no letter, or one at an end: the numbers divide
    if (lone) {
      const nums = body.flatMap((t, i) => (t.t === 'num' ? [i] : []));
      if (![2, 4, 6].includes(nums.length)) return null;
      halves = [body.slice(0, nums[nums.length / 2]), body.slice(nums[nums.length / 2])];
    } else if (at[0] === 0) halves = at.length === 2 ? [body.slice(0, at[1]), body.slice(at[1])] : null; // letters before their numbers
    else halves = [body.slice(0, at[0] + 1), body.slice(at[0] + 1)]; // letters after
  }
  const lat = halves && coordinate(halves[0], 'NS', 90), lon = halves && coordinate(halves[1], 'EW', 180);
  return lat === null || lon === null || lat === undefined || lon === undefined ? null : { lat, lon };
}
