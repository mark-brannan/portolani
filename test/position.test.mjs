import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePosition } from '../public/position.mjs';

// What Go reads from its box: typed text and the decimal latitude, longitude it comes to.
const dm = (d, m) => d + m / 60, dms = (d, m, s) => d + m / 60 + s / 3600;
const READ = [
  // decimal degrees
  ['38.0, 20.0', 38, 20],
  ['38 20', 38, 20],
  ['-38.5 20.25', -38.5, 20.25],
  ['36.28, -76', 36.28, -76],
  ['38.0° N 20.0° E', 38, 20],
  ['38.0N 20.0E', 38, 20],
  ['36.28S 76W', -36.28, -76],
  ['38 20W', 38, -20],
  ['38.5/20.25', 38.5, 20.25],
  ['38.5; 20.25', 38.5, 20.25],
  ['+38.5 +20.25', 38.5, 20.25],
  // degrees and decimal minutes
  ["38° 30.5' N 20° 15' E", dm(38, 30.5), dm(20, 15)],
  ['38 30.5 N, 20 15 E', dm(38, 30.5), dm(20, 15)],
  ['38 30 20 15', dm(38, 30), dm(20, 15)],
  ['38°30.5′N / 20°15′E', dm(38, 30.5), dm(20, 15)],
  ['-38 30.5, -20 15', -dm(38, 30.5), -dm(20, 15)],
  // degrees, minutes, seconds
  ['38°30\'15"N 20°15\'30"E', dms(38, 30, 15), dms(20, 15, 30)],
  ['38°30′15″N 20°15′30″E', dms(38, 30, 15), dms(20, 15, 30)],
  ['38 30 15 N 20 15 30 E', dms(38, 30, 15), dms(20, 15, 30)],
  ['38 30 15 20 15 30', dms(38, 30, 15), dms(20, 15, 30)],
  ['38d30m15s N, 20d15m30s E', dms(38, 30, 15), dms(20, 15, 30)],
  ['38d30m15s N 20d15m30s W', dms(38, 30, 15), -dms(20, 15, 30)],
  ['38 30 15.5 S, 20 15 30.25 W', -dms(38, 30, 15.5), -dms(20, 15, 30.25)],
  ["38°30'15''N 20°15'30''E", dms(38, 30, 15), dms(20, 15, 30)],
  ['-38 30 15, 20 15 30', -dms(38, 30, 15), dms(20, 15, 30)],
  // the hemisphere letter before its number, either case
  ['N 38.5 E 20.25', 38.5, 20.25],
  ['n38 w20', 38, -20],
  ['S 38° 30\' W 20° 15\'', -dm(38, 30), -dm(20, 15)],
  ['38.5s, 20.25e', -38.5, 20.25],
  // a letter and a sign together: the letter wins
  ['-38 S 20 E', -38, 20],
  ['-38 N 20 E', 38, 20],
  ['38 N -20 W', 38, -20],
  ['38 N -20 E', 38, 20],
  // the edges
  ['90 180', 90, 180],
  ['-90, -180', -90, -180],
  ['89 59 59.9 N 179 59 59.9 W', dms(89, 59, 59.9), -dms(179, 59, 59.9)],
  ['0 0', 0, 0],
];

test('Go reads a typed position in any form', () => {
  const rows = [];
  for (const [text, lat, lon] of READ) {
    const p = parsePosition(text);
    assert.ok(p, `no position read from ${text}`);
    assert.ok(Math.abs(p.lat - lat) < 1e-9 && Math.abs(p.lon - lon) < 1e-9, `${text}: ${p.lat}, ${p.lon}, not ${lat}, ${lon}`);
    rows.push(`${text.padEnd(32)} ${p.lat.toFixed(6).padStart(11)} ${p.lon.toFixed(6).padStart(11)}`);
  }
  if (process.env.POSITION_TABLE) console.log(rows.join('\n'));
});

// Typed text that is not a position, or is one out of range: null, so Go goes on to look for a place by that name.
const REFUSED = [
  '', '   ', 'London', 'Pitcairn', '10 Downing Street', '38', '38 N', 'N 38',
  '91 0', '-91 0', '0 181', '0 -181', '90 30 0 N 0 E', '38 60 0 N 20 E', '38 30 60 N 20 E', '38 30 15 N 20 60 0 E',
  '38 -30 20 15', '38 30.5 15 N 20 E', '38.5 30 N 20 E', '1 2 3 4 5', '1 2 3',
  '38,5 20,25', '38,5, 20,25', '38/30/15 N 20/15/30 E', '38, 20,', '38 E 20 N', '38 N 20 N', '38 N 20 S', '38 N 20 E 5',
  "38° 30\" N 20 E", "38' 20", '38d 30d 20 15', '38.5.5 20', '38,20,15', '38° 20 20', 'NaN NaN', '1e1 2e1',
];

test('Go refuses what is not a position, or is out of range', () => {
  for (const text of REFUSED) assert.equal(parsePosition(text), null, `read a position from ${JSON.stringify(text)}`);
});

test('a lower-case s after a third number is seconds; anywhere else it is south', () => {
  assert.deepEqual(parsePosition('38d30m15s N 20 E'), { lat: dms(38, 30, 15), lon: 20 });
  assert.deepEqual(parsePosition('38s 20w'), { lat: -38, lon: -20 });
  assert.deepEqual(parsePosition('38 30 15 s 20 15 30 w'), { lat: -dms(38, 30, 15), lon: -dms(20, 15, 30) });
  assert.deepEqual(parsePosition('38 30S 20 15W'), { lat: -dm(38, 30), lon: -dm(20, 15) });
});

test('a position written before the change still reads the same', () => {
  assert.deepEqual(parsePosition('36.28, -76'), { lat: 36.28, lon: -76 });
  assert.deepEqual(parsePosition('36.28N 76W'), { lat: 36.28, lon: -76 });
  assert.deepEqual(parsePosition('36.28S 76W'), { lat: -36.28, lon: -76 });
  assert.equal(parsePosition('-0, -0').lat, 0);
  assert.ok(Object.is(parsePosition('-0, -0').lat, 0), 'minus zero');
});
