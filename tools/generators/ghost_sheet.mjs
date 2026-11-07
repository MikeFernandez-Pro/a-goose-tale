// The phones' ghost sheet, baked from the PC's cloth (ghosts.ts): the game opened on WebGPU at the graveyard, its
// ghosts walking their paths, each sheet read in its ghost's own frame every SAMPLE_MS for SAMPLES reads and all of
// them averaged, so a turn either way or a gust comes out of it and the walk's hang stays.
//
//   node tools/generators/ghost_sheet.mjs
//
// Run from the repo root; writes src/characters/ghostsheet.json, which createPlainGhosts draws.
import { writeFileSync } from 'node:fs'
import { openGame } from '../page.mjs'

/** How long the cloth walks before it is read, ms: the settle after it wakes, and a stretch of its path. */
const WALKED = 8000
const SAMPLES = 40
const SAMPLE_MS = 250
/** The cloth's grid, its points a side (ghosts.ts SIDE). */
const SIDE = 41

const game = await openGame('?opening=0&ending=0&mute&ghostbake#_debug')
const { page } = game
try {
  // Driven, the page asks for no Enter: in play once its readouts show, the torch's among them.
  await page.waitForFunction(() => document.body.innerText.includes('torch'), undefined, { timeout: 300000 })
  await page.waitForTimeout(3000)
  // 4, a debug key: at the graveyard's entrance, its ghosts woken.
  await page.keyboard.press('Digit4')
  await page.waitForTimeout(WALKED)
  const sum = new Float64Array(SIDE * SIDE * 3)
  let reads = 0
  for (let s = 0; s < SAMPLES; s++) {
    const sheets = await page.evaluate(() => globalThis.ghostSheets())
    for (const sheet of sheets) {
      if (sheet.length !== sum.length || sheet.some((v) => !Number.isFinite(v))) throw new Error(`a sheet of ${sheet.length} numbers, or not all of them numbers`)
      sheet.forEach((v, k) => (sum[k] += v))
      reads++
    }
    await page.waitForTimeout(SAMPLE_MS)
  }
  if (game.errors.length > 0) throw new Error(`the page: ${game.errors.join('\n')}`)
  const points = [...sum].map((v) => Math.round((v / reads) * 1e4) / 1e4)
  writeFileSync('src/characters/ghostsheet.json', `${JSON.stringify({ side: SIDE, points })}\n`)
  console.log(`${reads} sheets averaged, lowest point ${Math.min(...points.filter((_, k) => k % 3 === 1))} m, highest ${Math.max(...points.filter((_, k) => k % 3 === 1))} m`)
} finally {
  await game.close()
}
