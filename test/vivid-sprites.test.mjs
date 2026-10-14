// The vivid pack is drawn as SVG and rasterised in Node by @napi-rs/canvas (resvg): every SVG in
// packs/vivid/ must load to a non-empty image, and every sprite the manifest names must exist and
// put ink on the canvas at its sizePx (a file leaning on a font, a filter or an external reference
// loads but draws nothing). Offline: it reads only the pack.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadImage, createCanvas } from '@napi-rs/canvas'

const VIVID = fileURLToPath(new URL('../packs/vivid/', import.meta.url))
const pack = JSON.parse(readFileSync(`${VIVID}pack.json`, 'utf8'))

for (const file of readdirSync(VIVID).filter((f) => f.endsWith('.svg'))) {
  test(`vivid SVG renders: ${file}`, async () => {
    const img = await loadImage(`${VIVID}${file}`)
    assert.ok(img.width > 0 && img.height > 0, `${file}: ${img.width} x ${img.height}`)
  })
}

test('every vivid pack entry names a file that exists', () => {
  for (const s of pack.sprites) assert.ok(existsSync(`${VIVID}${s.file}`), `${s.id}: ${s.file} missing`)
})

test('every vivid pack entry draws ink at its sizePx', async () => {
  for (const s of pack.sprites) {
    const c = createCanvas(s.sizePx, s.sizePx), g = c.getContext('2d')
    g.drawImage(await loadImage(`${VIVID}${s.file}`), 0, 0, s.sizePx, s.sizePx)
    const px = g.getImageData(0, 0, s.sizePx, s.sizePx).data
    let inked = 0
    for (let i = 3; i < px.length; i += 4) if (px[i]) inked++
    assert.ok(inked > 0, `${s.id}: draws nothing at ${s.sizePx} px`)
  }
})

test('vivid monsters and ships carry their placement fields', () => {
  for (const s of pack.sprites.filter((s) => s.kind === 'monster' || s.kind === 'ship')) {
    assert.ok(s.style && s.after, `${s.id}: style and after`)
    if (s.kind === 'monster') assert.ok(s.weight > 0 && s.minClearancePx > 0, `${s.id}: weight and minClearancePx`)
    else assert.ok(['left', 'right'].includes(s.heading), `${s.id}: heading`)
  }
})

test('vivid roses name their style and what they are after', () => {
  for (const s of pack.sprites.filter((s) => s.kind === 'rose')) {
    assert.match(s.style ?? '', /^[a-z][a-z-]*$/, `${s.id}: style slug`)
    assert.match(s.after ?? '', /^https:\/\//, `${s.id}: after URL`)
  }
})
