// The debug keys, on the developer's page and in a take.
import type { Settings } from '../settings'
import type { GoosePlay } from './gooseplay'
import type { PlaySwarm } from '../swarm/play'
import { type PondLook, islandMiddle, islandShoreAt } from '../world/pond'
import type { Graveyard } from '../world/graveyard'

/** How far off the island's waterline the 6 debug key stands him, m. */
const ISLAND_BY = 1

/** The keys, on what the page has made; `showDeath` his death played through where he stands. */
export function createDebugKeys({ settings, run, goosePlay, pondLook, graveyard, showDeath }: {
  settings: Settings
  run: GoosePlay<PlaySwarm>['run']
  goosePlay: GoosePlay<PlaySwarm>
  pondLook: PondLook
  graveyard: Graveyard | undefined
  showDeath: () => void
}) {
  const debugKeys = {
    /** The game's torch held full each frame, its F debug key's. */
    torchEverlasting: false,
    standOffIsland,
    standAtGraveyard,
  }
  /** ISLAND_BY m off the island's waterline on the camera's side (+z), facing it. */
  function standOffIsland() {
    const middle = islandMiddle(pondLook)
    const { holder, facing } = goosePlay.run
    holder.x = middle.x
    holder.z = middle.z + islandShoreAt(pondLook.island, Math.PI / 2) + ISLAND_BY
    facing.x = 0
    facing.z = -1
  }
  /** At the graveyard's entrance, facing in. */
  function standAtGraveyard() {
    if (!graveyard) return
    const { holder, facing } = goosePlay.run
    holder.x = graveyard.entrance.x
    holder.z = graveyard.entrance.z
    facing.x = graveyard.entrance.facing.x
    facing.z = graveyard.entrance.facing.z
  }
  // In the game F, a debug key, gives the torch a light that never burns down, held full each frame; and puts it out
  // again for real, its fuel gone, so nothing holds the rats off his circle until a fire fills it. Taken here first, before the panel's own F, which only hides the light from the rats. 0 to 5 on the
  // top row, debug keys too, stand him back where he starts, by the well's zone, the dead tree's, the
  // cage's and, on 5, the pond; on 6 in the water just off its island, facing it. Any other number, or 0 to 5 on the keypad, gives him that many goslings at
  // once, 0 none (the key's place, so the AZERTY row needs no shift).
  addEventListener(
    'keydown',
    (event) => {
      if (event.repeat || !settings.debug || event.target instanceof HTMLInputElement) return
      const digit = /^(?:Digit|Numpad)(\d)$/.exec(event.code)
      if (event.code === 'KeyF') run.fuel = (debugKeys.torchEverlasting = !debugKeys.torchEverlasting) ? 1 : 0
      else if (event.code === 'KeyK' && !goosePlay.down) {
        // K: his life gone where he stands, as if bitten away, to try his death.
        goosePlay.life = 0
        goosePlay.bittenAt = goosePlay.t
      }
      // J: his death clip played through where he stands, whole, without dying, to see it.
      else if (event.code === 'KeyJ' && !goosePlay.down) showDeath()
      else if (event.code === 'Digit0') goosePlay.standAtStart()
      else if (event.code === 'Digit1') goosePlay.standBy('well')
      else if (event.code === 'Digit2') goosePlay.standBy('tree')
      else if (event.code === 'Digit3') goosePlay.standBy('cage')
      else if (event.code === 'Digit5') goosePlay.standByPond()
      else if (event.code === 'Digit6') standOffIsland()
      else if (event.code === 'Digit4' && graveyard) standAtGraveyard()
      else if (digit) goosePlay.giveGoslings(Number(digit[1]))
      else return
      event.preventDefault()
      event.stopImmediatePropagation()
    },
    { capture: true },
  )
  return debugKeys
}
