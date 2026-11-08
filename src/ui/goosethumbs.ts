// A Goose Tale's touch screen on the page (#198): the shell round the touch
// core (goosetouch.ts), which the controls hold. It hears the pointer events of
// touch type and keeps them for the controls' next frame, a contact landing on
// a button left to the button; lets every contact go on a cancel, the page
// losing focus or hidden, and when the game asks (it pauses); keeps the page
// from scrolling, zooming, selecting or opening a menu under the thumbs; and
// draws, in the hints' ink, the small stick where the thumb landed, its knob under the thumb and its ring after it,
// shown resting at the screen's bottom left only to a player who has not found it, the play waiting on a first walk; and the round button at its bottom right,
// its circle the one the prompts show, sinking the moment a thumb lands on it, a ring round it, clear of the thumb,
// filling as a hold goes on. Each is shown only where it does something (Apple's game controls guidelines).

import { FILL, INK, ledgeOf, touchSignDrawn } from './holdhint'
import { BUTTON_RADIUS, STICK_REACH, touchLayout, type TouchContact, type TouchReading } from './goosetouch'

/** The knob's width, px. */
const KNOB = 38
/** How strong they show untouched, and with a thumb on them. */
const RESTING = 0.6
/** How long the play waits on a first walk before the stick is shown at rest, s: after the first gosling's call, before the burning tree's hint; and how long it fades in, s. */
const STICK_HINT_AFTER = 2
const STICK_HINT_FADE = 0.4
const TOUCHED = 0.95
/** The ground the stick's ring and the button stand on: the prompts' keys'. */
const GROUND = '#0007'
/** The ring round the button that fills as a hold goes on, shown while a thumb is on it or the hold is under way: its radius, px, out past the thumb, and how thick. */
const HOLD_RING = BUTTON_RADIUS + 16
const HOLD_STROKE = 7
/** The pause key's width, px: a thumb's least target. It stands at the screen's top right, out of the way of both thumbs. */
const PAUSE_KEY = 44
/** How soon after a tap another counts as its double, ms: Safari's double tap, a little longer. */
const DOUBLE_TAP = 350
/** What a contact landing on belongs to, never a thumb. */
const BUTTONS = 'button, a, input, select, textarea, label'

export interface Thumbs {
  /** The contacts since the last take, in the order they came, and whether a touch landed on a button: then forgotten. */
  take(): { touches: TouchContact[]; tapped: boolean }
  /** Every contact down let go, as cancelled, at the next take. */
  letGo(): void
  /** The stick, the button and the pause key drawn as `reading` has them, each only if `shown`, the button's ring filled `share` of the way, 0 to 1. */
  draw(reading: TouchReading, shown: { stick: boolean; button: boolean; pause: boolean }, share: number): void
}

/** How deep the ledge under a touch control stands, px, at the most: thinner than a prompt's key's on the larger ones. */
const LEDGE_MOST = 4
/** The ledge under a touch control `size` px across, px. */
const thumbLedge = (size: number) => Math.min(ledgeOf(size), LEDGE_MOST)

/** A ring `size` px across, centred on where it is put, in the hints' ink, filled with `fill`, standing on its ink ledge as the prompts' keys do. */
function ring(size: number, fill: string): HTMLDivElement {
  const element = document.createElement('div')
  element.style.cssText = `position:fixed;left:0;top:0;width:${size}px;height:${size}px;box-sizing:border-box;margin:${-size / 2}px 0 0 ${-size / 2}px;border:3px solid ${INK};border-radius:50%;background:${fill};box-shadow:0 ${thumbLedge(size)}px 0 ${INK}99;pointer-events:none;z-index:30;display:none`
  document.body.append(element)
  return element
}

/** `element` shown centred at (x, y) on the page, px, or hidden. */
function place(element: HTMLElement, at: { x: number; y: number } | null) {
  element.style.display = at ? '' : 'none'
  if (at) element.style.transform = `translate(${at.x}px,${at.y}px)`
}

/** The page under the thumbs held still: no scrolling, zooming, selecting or long-press menu. */
function holdThePage() {
  for (const style of [document.documentElement.style, document.body.style]) {
    style.touchAction = 'none'
    style.userSelect = 'none'
    style.setProperty('-webkit-user-select', 'none')
    style.setProperty('-webkit-touch-callout', 'none')
  }
  addEventListener('contextmenu', (event) => event.preventDefault())
  document.addEventListener('touchmove', (event) => event.preventDefault(), { passive: false })
  document.addEventListener('gesturestart', (event) => event.preventDefault())
  // Safari zooms on a second quick tap whatever the touch-action: that tap's end let go of, but on a button, whose click it is.
  let tapEnded = Number.NEGATIVE_INFINITY
  document.addEventListener(
    'touchend',
    (event) => {
      const onButton = event.target instanceof Element && event.target.closest(BUTTONS)
      if (event.timeStamp - tapEnded < DOUBLE_TAP && !onButton) event.preventDefault()
      tapEnded = event.timeStamp
    },
    { passive: false },
  )
  document.addEventListener('dblclick', (event) => event.preventDefault())
}

/** The shell on the page, listening; the page held still at once where the pointer is a finger, else from the first touch. `pause` when its key is tapped: a phone has no Escape. */
export function createThumbs(pause: () => void): Thumbs {
  let touches: TouchContact[] = []
  let tapped = false
  /** The contacts forwarded and still down, where they last were. */
  const down = new Map<number, { x: number; y: number }>()
  let held = false
  const holdOnce = () => {
    if (held) return
    held = true
    holdThePage()
  }
  if (matchMedia('(pointer: coarse)').matches) holdOnce()

  const heard = (phase: TouchContact['phase']) => (event: PointerEvent) => {
    if (event.pointerType !== 'touch') return
    const { pointerId: id, clientX: x, clientY: y } = event
    if (phase === 'down') {
      holdOnce()
      if (event.target instanceof Element && event.target.closest(BUTTONS)) {
        tapped = true
        return
      }
      down.set(id, { x, y })
    } else if (!down.has(id)) return
    else if (phase === 'move') down.set(id, { x, y })
    else down.delete(id)
    touches.push({ id, x, y, phase })
  }
  addEventListener('pointerdown', heard('down'), { capture: true })
  addEventListener('pointermove', heard('move'), { capture: true })
  addEventListener('pointerup', heard('up'), { capture: true })
  addEventListener('pointercancel', heard('cancel'), { capture: true })

  const letGo = () => {
    for (const [id, { x, y }] of down) touches.push({ id, x, y, phase: 'cancel' })
    down.clear()
  }
  addEventListener('blur', letGo)
  document.addEventListener('visibilitychange', () => document.hidden && letGo())

  const base = ring(STICK_REACH * 2, GROUND)
  const knob = ring(KNOB, `${INK}40`)
  const button = ring(BUTTON_RADIUS * 2, GROUND)
  const buttonLedge = thumbLedge(BUTTON_RADIUS * 2)
  const sign = document.createElement('div')
  sign.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center'
  sign.innerHTML = touchSignDrawn(BUTTON_RADIUS * 1.5)
  button.append(sign)
  /** Whether the stick has been used: till then, the play waiting on it, it is drawn at rest, to show where it is. */
  let walked = false
  /** When the stick was last given to the play, s, performance's clock; NaN while it is not. */
  let stickSince = Number.NaN

  const holdSize = (HOLD_RING + HOLD_STROKE) * 2
  const around = 2 * Math.PI * HOLD_RING
  const holdRing = document.createElement('div')
  holdRing.style.cssText = `position:fixed;left:0;top:0;width:${holdSize}px;height:${holdSize}px;margin:${-holdSize / 2}px 0 0 ${-holdSize / 2}px;pointer-events:none;z-index:30;display:none;filter:drop-shadow(0 2px 4px #000c)`
  holdRing.innerHTML = `<svg width="${holdSize}" height="${holdSize}" viewBox="${-holdSize / 2} ${-holdSize / 2} ${holdSize} ${holdSize}" style="display:block">
<circle r="${HOLD_RING}" fill="none" stroke="#0007" stroke-width="${HOLD_STROKE}"/>
<circle r="${HOLD_RING}" fill="none" stroke="${FILL}" stroke-width="${HOLD_STROKE}" stroke-linecap="round" stroke-dasharray="${around}" transform="rotate(-90)"/>
</svg>`
  const holdArc = holdRing.querySelectorAll('circle')[1]!
  document.body.append(holdRing)

  const pauseKey = document.createElement('button')
  pauseKey.setAttribute('aria-label', 'Pause')
  pauseKey.style.cssText = `position:fixed;top:16px;right:16px;width:${PAUSE_KEY}px;height:${PAUSE_KEY}px;box-sizing:border-box;padding:0;display:none;align-items:center;justify-content:center;gap:5px;border:3px solid ${INK};border-radius:50%;background:${GROUND};box-shadow:0 ${thumbLedge(PAUSE_KEY)}px 0 ${INK}99;opacity:${RESTING};z-index:30`
  for (let bar = 0; bar < 2; bar++) {
    const drawn = document.createElement('span')
    drawn.style.cssText = `width:5px;height:16px;border-radius:2px;background:${INK}`
    pauseKey.append(drawn)
  }
  pauseKey.addEventListener('click', pause)
  document.body.append(pauseKey)

  return {
    take() {
      const taken = { touches, tapped }
      touches = []
      tapped = false
      return taken
    },
    letGo,
    draw(reading, shown, share) {
      const layout = touchLayout({ width: innerWidth, height: innerHeight })
      if (shown.stick && reading.stick) walked = true
      const now = performance.now() / 1000
      if (!shown.stick) stickSince = Number.NaN
      else if (Number.isNaN(stickSince)) stickSince = now
      const hinted = walked || !shown.stick ? 0 : Math.min(1, Math.max(0, (now - stickSince - STICK_HINT_AFTER) / STICK_HINT_FADE))
      const resting = hinted > 0 ? layout.stick : null
      place(base, shown.stick ? (reading.stick?.middle ?? resting) : null)
      place(knob, shown.stick ? (reading.stick?.knob ?? resting) : null)
      // Under a thumb, the button sinks onto its ledge, as a key goes down.
      place(button, shown.button ? { x: layout.button.x, y: layout.button.y + (reading.button ? buttonLedge : 0) } : null)
      button.style.boxShadow = `0 ${reading.button ? 0 : buttonLedge}px 0 ${INK}99`
      pauseKey.style.display = shown.pause ? 'flex' : 'none'
      const held = Math.min(1, Math.max(0, share))
      place(holdRing, shown.button && (reading.button || held > 0) ? layout.button : null)
      holdArc.style.display = held > 0 ? '' : 'none'
      holdArc.setAttribute('stroke-dashoffset', `${around * (1 - held)}`)
      const stickHeld = `${reading.stick ? TOUCHED : RESTING * hinted}`
      base.style.opacity = knob.style.opacity = stickHeld
      button.style.opacity = `${reading.button ? TOUCHED : RESTING}`
    },
  }
}
