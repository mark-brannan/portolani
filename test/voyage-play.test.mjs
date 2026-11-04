// The play button sails a voyage on its own calendar (docs/spec/design.md, the voyage row's Feature; scripts/voyages.mjs
// readDates, calendarOf, penOn): a leg's dates read as two spans of days, the pen still through every wait, the whole
// voyage in VOYAGE_PLAY's seconds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDates, legDates, calendarOf, penOn, dayText, dayOf, problems, VOYAGE_PLAY, voyagePlaySeconds, readVoyage, playDateText, playPace, isLong, LONG_YEARS } from '../scripts/voyages.mjs';
import { readJSON } from '../scripts/check-voyages.mjs';

const ends = (text) => { const r = readDates(text); return r && [dayText(r.start.span[0], r.start.precision), dayText(r.end.span[1] - 1, r.end.precision)]; };

test('a leg\'s date words read as two ends, each as precise as the words', () => {
  for (const [text, want] of [
    ['20–26 Sep 1519', ['20 Sep 1519', '26 Sep 1519']],
    ['Nov – 29 Nov 1519', ['Nov 1519', '29 Nov 1519']],
    ['28 Nov 1520 – 6 Mar 1521', ['28 Nov 1520', '6 Mar 1521']],
    ['27 Apr 1521', ['27 Apr 1521', '27 Apr 1521']],
    ['c. 1165-66', ['1165', '1166']],
    ['1271–72', ['1271', '1272']],
    ['June-July 1253', ['Jun 1253', 'Jul 1253']],
    ['Dec 325 – Feb 324 BC', ['Dec 325 BC', 'Feb 324 BC']],
    ['c. 800 BC – c. 1000 CE', ['800 BC', '1000']],
    ['1324, to July', ['1324', 'Jul 1324']],
    ['1502 or 1503', ['1502', '1503']],
    ['13th–14th century', ['c. 1201', 'c. 1400']],
    ['Christmas 1254', ['25 Dec 1254', '25 Dec 1254']],
  ]) assert.deepEqual(ends(text), want, text);
  assert.equal(readDates('winter 1332–33').start.span[0], dayOf(1332, 11), 'a winter starts in December');
  assert.equal(readDates('early 1327').start.span[1], dayOf(1327, 4), 'early is the first third of the year');
  assert.equal(readDates('after 1513').end.span[1], Infinity, 'after has no end');
  assert.equal(readDates('the old days'), null);
});

test('a leg\'s ISO start and end win over its words, and the schema checks them', () => {
  const leg = { dates: 'Nov – 29 Nov 1519', start: '1519-11-02', end: '1519-11-29' };
  assert.equal(legDates(leg).start.precision, 'day');
  assert.equal(legDates(leg).start.span[0], dayOf(1519, 10, 2));
  assert.equal(legDates({ start: '-0324-12' }).start.span[0], dayOf(-324, 11), 'December 325 BC');
  const v = { id: 'x', title: 'X', short: 'X', when: '1519', summary: 'S', who: ['nobody'], sources: [{ title: 't', url: 'https://e.org' }], events: [],
    legs: [{ from: 'a', to: 'b', mode: 'sea', line: 'rhumb', confidence: 'attested', source: 's', points: [[0, 0], [1, 1]], start: '1519-11', end: '29 Nov 1519' }] };
  assert.deepEqual(problems(v).filter((p) => /start|end/.test(p)).length, 1, 'end in words is refused, start in ISO taken');
});

test('Magellan sails on his calendar: still through the San Julián winter, across the Pacific in its 98 days, nine seconds in all', async () => {
  const v = await readVoyage('magellan', readJSON), cal = calendarOf(v);
  assert.equal(Math.round(cal.t1 - cal.t0), 1083, '20 Sep 1519 to 6 Sep 1522, both days counted');
  const julian = cal.legs.findIndex((l) => l.from === 'Puerto San Julián');
  const winter = penOn(cal, dayOf(1520, 5, 20)); // 20 Jun 1520
  assert.equal(winter.waiting, true);
  assert.equal(winter.leg, julian);
  assert.equal(penOn(cal, dayOf(1520, 4, 1)).share, winter.share, 'the pen does not move while it waits');
  const pacific = cal.legs.find((l) => l.to === 'Guam');
  assert.equal(dayText(pacific.a), '28 Nov 1520'); assert.equal(dayText(pacific.b), '6 Mar 1521');
  const mid = penOn(cal, (pacific.a + pacific.b) / 2), out = penOn(cal, pacific.a + 1);
  assert.ok(mid.share > out.share && !mid.waiting, 'the pen runs across open water');
  assert.ok(cal.legs.every((l, i) => l.b >= l.a && (!i || l.a >= cal.legs[i - 1].b)), 'no end before the one before it');
  assert.equal(penOn(cal, cal.t1).share, 1);
  const mactan = v.events.findIndex((e) => e.kind === 'death' && /Mactan/.test(e.label));
  assert.equal(dayText(cal.events[mactan]), '27 Apr 1521', 'Magellan\'s death appears as the pen reaches its date');
  assert.equal(VOYAGE_PLAY.seconds, 9);
});

test('legs that share a vague span share it evenly: Polo\'s six legs of 1271', async () => {
  const cal = calendarOf(await readVoyage('polo', readJSON)), y = [dayOf(1271), dayOf(1272)];
  const first = cal.legs.slice(0, 6);
  assert.ok(first.every((l) => l.a >= y[0] && l.b <= y[1]), 'all inside 1271');
  const steps = first.flatMap((l) => [l.a, l.b]).map((d, i, all) => (i ? d - all[i - 1] : null)).slice(1);
  assert.ok(Math.max(...steps) - Math.min(...steps) < 1, `even steps: ${steps.map((s) => s.toFixed(1))}`);
});

test('every voyage has a calendar that runs forward, and its events fall inside it', async () => {
  for (const id of readJSON('data/voyages/index.json')) {
    const cal = calendarOf(await readVoyage(id, readJSON));
    assert.ok(cal && cal.t1 > cal.t0, `${id}: a calendar`);
    // a migration's legs are branches under way at once, so only each on its own runs forward
    assert.ok(cal.legs.every((l, i) => Number.isFinite(l.a) && l.b >= l.a && (cal.concurrent || !i || l.a >= cal.legs[i - 1].b)), `${id}: forward`);
    assert.ok(cal.legs.every((l) => l.stops.every((s, j) => !j || (s[0] >= l.stops[j - 1][0] && s[1] >= l.stops[j - 1][1]))), `${id}: stops in order`);
    assert.ok(cal.events.every((d) => d >= cal.t0 && d <= cal.t1), `${id}: events inside`);
  }
});

test('the Lapita stream plays on its own calendar: the pen at each settlement on its date, the New Caledonia branch beside it', async () => {
  const v = await readVoyage('lapita-expansion', readJSON), cal = calendarOf(v), year = (d) => dayText(d, 'year');
  assert.equal(cal.concurrent, true);
  assert.deepEqual([year(cal.t0), year(cal.t1)], ['1500 BC', '800 BC']);
  const at = (label) => cal.events[v.events.findIndex((e) => e.label.startsWith(label))];
  assert.deepEqual(['Watom', 'Nenumbo', 'Natunuku', 'Nukuleka', 'Mulifanua'].map((l) => year(at(l))), ['1350 BC', '1200 BC', '1100 BC', '900 BC', '800 BC']);
  const teouma = at('Teouma');
  assert.ok(teouma > at('Nenumbo') && teouma < at('Natunuku'), 'Teouma, "c. 1200–1000 BC", between the Reef Islands and Fiji');
  const [main, branch] = cal.legs;
  for (const [sample, day, place] of main.stops.slice(1, -1)) {
    const pen = penOn(cal, day);
    assert.ok(Math.abs(pen.legs[0] * main.n - sample) < 1e-6, `the pen at ${place} on its day`);
  }
  assert.equal(branch.a, teouma, 'the branch to New Caledonia sets out as the stream passes Efate');
  assert.equal(year(branch.b), '1100 BC');
  const mid = penOn(cal, (branch.a + branch.b) / 2);
  assert.ok(mid.legs[0] > 0 && mid.legs[0] < 1 && mid.legs[1] > 0 && mid.legs[1] < 1, 'both under way at once');
  assert.equal(mid.leg, 1, 'the band names the branch set out latest');
  assert.ok(penOn(cal, at('Watom') + 1).from.startsWith('Watom'), 'the band names the stretch between settlements');
  const half = penOn(cal, cal.t0 + 0.55 * (cal.t1 - cal.t0));
  assert.ok(half.share > 0 && half.share < 1);
});

test('the East Polynesian settlement plays too: its branches each from where an earlier one landed', async () => {
  const v = await readVoyage('east-polynesia-settlement', readJSON), cal = calendarOf(v), year = (d) => dayText(d, 'year');
  assert.deepEqual([year(cal.t0), year(cal.t1)], ['800 BC', '1500']);
  const leg = (to) => cal.legs[v.legs.findIndex((l) => l.to.startsWith(to))];
  assert.ok(leg('Hawai').a >= leg('Tahiti').b && leg('Rapa Nui').a >= leg('Tahiti').b, 'out of Tahiti once Tahiti is reached');
  assert.equal(leg('the coast').a, leg('Rapa Nui').b, 'to South America from Rapa Nui as it is reached');
  const gap = penOn(cal, (leg('Tahiti').b + leg('Rapa Nui').a) / 2);
  assert.equal(gap.waiting, true);
  assert.equal(cal.legs[gap.before].to, 'Tahiti');
});

test('a long calendar is told in years: "c. 1210 BC" and "about 80 years a second"; a short one as before', async () => {
  const lapita = calendarOf(await readVoyage('lapita-expansion', readJSON)), magellan = calendarOf(await readVoyage('magellan', readJSON));
  assert.equal(isLong(lapita), true); assert.equal(isLong(magellan), false);
  assert.equal(playDateText(lapita, dayOf(-1211, 5, 1), 'day'), 'c. 1210 BC', '1212 BC to the nearest ten years');
  assert.equal(playDateText(lapita, lapita.t0, 'year'), 'c. 1500 BC');
  assert.equal(playPace(lapita, 9), 'about 80 years a second');
  assert.equal(playPace(lapita, 30), 'about 20 years a second');
  const polynesia = calendarOf(await readVoyage('east-polynesia-settlement', readJSON));
  assert.equal(playDateText(polynesia, dayOf(1234), 'year'), 'c. 1250', 'past 1,000 years, to the nearest fifty');
  assert.equal(playDateText(magellan, dayOf(1520, 5, 20), 'day'), dayText(dayOf(1520, 5, 20), 'day'), 'a short calendar keeps its days');
  assert.equal(playPace(magellan, 9), '1,083 days in 9 s');
  const short = { t0: dayOf(1300), t1: dayOf(1349) }, long = { t0: dayOf(1300), t1: dayOf(1352) };
  assert.equal(isLong(short), false, '49 years'); assert.equal(isLong(long), true, '52 years');
  assert.equal(LONG_YEARS, 50);
});

test('a link\'s voyageplay= is the seconds a play takes, 3 to 30; any other value plays at the default', () => {
  for (const [text, s] of [[null, 9], ['', 9], ['3', 3], ['12', 12], ['30', 30], ['2', 9], ['31', 9], ['9.5', 9], ['slow', 9]]) {
    assert.equal(voyagePlaySeconds(text), s, `voyageplay=${text}`);
  }
});
