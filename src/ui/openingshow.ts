// What the opening shows over the game: how to skip it, his shouts after his goslings, and a soft light on them.
import type { Opening } from '../game/opening'
import { SKIP_HOLD } from '../game/opening'
import type { GooseSounds } from '../sound/goosesounds'
import type { GoosePlay } from '../game/gooseplay'
import type { PlaySwarm } from '../swarm/play'
import type { Goose } from '../characters/goose'
import { type PerspectiveCamera, type WebGPURenderer, type Scene, Vector3 } from 'three/webgpu'
import { type FakeLamps, FakeLamp } from '../light/fakelamps'
import { createPadButton, promptedOf } from './holdhint'
import type { Commands } from './goosecontrols'
import { INTRO } from '../game/gooseintro'

/** How the opening is shown, on what the page has made. */
export function createOpeningShow({ opening, goosePlay, goose, camera, renderer, gooseSounds, hisAt, fakeLamps, scene, standAt }: {
  opening: Opening
  goosePlay: GoosePlay<PlaySwarm>
  goose: Goose
  camera: PerspectiveCamera
  renderer: WebGPURenderer
  gooseSounds: GooseSounds | undefined
  hisAt: () => { x: number; y: number; z: number }
  fakeLamps: FakeLamps
  scene: Scene
  standAt: (x: number, z: number) => number
}) {
  /**
   * How to skip the opening, at the foot of the screen while it runs, in the hold hint's hand and key: "hold to skip" by a
   * Space key filling as it is held, or on a pad by its round button.
   */
  const SKIP_KEY = 'box-sizing:border-box;font-size:24px;line-height:1.2;padding:1px 14px;border:3px solid #f6ead0;border-radius:11px;background:#0007;box-shadow:0 3px 0 #f6ead099'
  const skipHint = opening.on ? document.createElement('div') : undefined
  const skipFill = document.createElement('div')
  const skipSpace = document.createElement('div')
  /** As tall as the Space key, borders and all, px. */
  const skipPad = createPadButton(37)
  if (skipHint) {
    skipHint.style.cssText = 'position:fixed;right:28px;bottom:24px;display:flex;align-items:center;gap:10px;opacity:0;transition:opacity 0.6s;font-family:Gaegu,cursive;font-weight:700;font-size:26px;color:#f6ead0;text-shadow:0 2px 4px #000c;pointer-events:none'
    skipSpace.style.cssText = `${SKIP_KEY};position:relative;overflow:hidden;width:96px;text-align:center`
    skipFill.style.cssText = 'position:absolute;left:0;top:0;bottom:0;width:0;background:#e9a23b;opacity:0.6'
    const label = document.createElement('span')
    label.textContent = 'space'
    label.style.position = 'relative'
    skipSpace.append(skipFill, label)
    const word = (text: string) => Object.assign(document.createElement('span'), { textContent: text })
    skipHint.append(word('hold to skip'), skipSpace, skipPad.element)
    document.body.append(skipHint)
  }
  /** How high the words stand over the screen's foot on touch, px: clear of the button. */
  const SKIP_OVER_BUTTON = 102
  function skipHintFrame(commands: Commands) {
    if (!skipHint) return
    const shown = opening.running() && opening.t > 0.8 && opening.t < INTRO.end - 0.6
    skipHint.style.opacity = shown ? '0.8' : '0'
    const share = Math.min(1, opening.skipHolding / SKIP_HOLD)
    const prompted = promptedOf(commands)
    skipSpace.style.display = prompted ? 'none' : ''
    // On touch no button of its own: the words stand over the one button there is, which fills.
    skipPad.update(prompted === 'touch' ? null : prompted, share)
    skipHint.style.bottom = prompted === 'touch' ? `${SKIP_OVER_BUTTON}px` : '24px'
    skipFill.style.width = `${Math.round(share * 100)}%`
  }
  /** His shouts after his goslings as they bolt: HONK! over his head, one at each of INTRO.shouts, popping up and rising off it, SHOUT_SHOWS s each. */
  const SHOUT_SHOWS = 0.9
  const shouts = opening.on
    ? INTRO.shouts.map(() => {
        const word = document.createElement('div')
        word.textContent = 'HONK!'
        word.style.cssText = 'position:fixed;left:0;top:0;pointer-events:none;opacity:0;white-space:nowrap;font-family:Gaegu,cursive;font-weight:700;font-size:46px;line-height:1;color:#f6ead0;text-shadow:0 2px 4px #000c'
        document.body.append(word)
        return word
      })
    : []
  const shoutAt = new Vector3()
  /** The last of his shouts heard. */
  let shoutsHeard = -1
  function shoutFrame() {
    shouts.forEach((word, k) => {
      const age = opening.t - INTRO.shouts[k]!
      const shown = opening.running() && age >= 0 && age < SHOUT_SHOWS
      if (shown && k > shoutsHeard) {
        shoutsHeard = k
        gooseSounds?.play('honk', hisAt())
      }
      word.style.opacity = shown ? String(Math.min(1, age / 0.06) * Math.min(1, (SHOUT_SHOWS - age) / 0.35)) : '0'
      if (!shown) return
      shoutAt.set(goose.object.position.x, goose.object.position.y + 1.05, goose.object.position.z).project(camera)
      const box = renderer.domElement.getBoundingClientRect()
      const x = box.left + ((shoutAt.x + 1) / 2) * box.width + (k % 2 ? 34 : -34)
      const y = box.top + ((1 - shoutAt.y) / 2) * box.height - 46 * Math.min(1, age / 0.45)
      const pop = age < 0.1 ? 0.6 + (age / 0.1) * 0.75 : Math.max(1, 1.35 - (age - 0.1) * 1.2)
      word.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%) rotate(${k % 2 ? 9 : -9}deg) scale(${pop})`
    })
  }
  /**
   * A soft light over him and his goslings through the opening, only to lead the eye to them: gentle, a pale
   * pool `height` m over him, coming up over its first `fadeIn` s and gone over its last `fadeOut` s; no shadow from it.
   */
  const introLightLook = { show: true, color: 0xdde4ff, intensity: 2, reach: 5, height: 2.6, fadeIn: 1.5, fadeOut: 2 }
  const introLight = opening.on ? fakeLamps.track(new FakeLamp(introLightLook.color, 0, introLightLook.reach, 0)) : undefined
  if (introLight) {
    introLight.shadows = false
    scene.add(introLight)
  }
  /** The opening's light over him as the opening has it now, out once it is over. */
  function introLightFrame() {
    if (!introLight) return
    const { show, color, intensity, reach, height, fadeIn, fadeOut } = introLightLook
    const share = Math.min(1, opening.t / Math.max(fadeIn, 1e-3), (INTRO.end - opening.t) / Math.max(fadeOut, 1e-3))
    introLight.intensity = show && opening.running() ? intensity * Math.max(0, share) : 0
    if (!(introLight.intensity > 0)) return
    introLight.color.setHex(color)
    introLight.distance = reach
    const { x, z } = goosePlay.holder
    introLight.position.set(x, standAt(x, z) + height, z)
  }
  return { introLight, introLightLook, skipHintFrame, shoutFrame, introLightFrame }
}
