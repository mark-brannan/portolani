// The pixel bar for a golden, shared by test/golden.test.mjs (the gate) and scripts/golden-diff.mjs
// (the report), so the two cannot drift apart.
export const CHANNEL = 24; // a pixel differs when any channel moves more than this

// Compare two RGBA buffers of w x h. Returns the count of differing pixels and an RGBA diff image
// (differing pixels red, the rest the first image dimmed).
export function compare(a, b, w, h, createImageData) {
  const data = createImageData(w, h);
  let bad = 0;
  for (let i = 0; i < a.length; i += 4) {
    const off = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
    const hit = off > CHANNEL;
    if (hit) bad++;
    data.data.set(hit ? [255, 0, 0, 255] : [a[i] >> 1, a[i + 1] >> 1, a[i + 2] >> 1, 255], i);
  }
  return { bad, data };
}
