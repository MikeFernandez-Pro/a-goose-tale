// What the player asks of the game. The keys, the pads and the thumbs go through the controls (goosecontrols.ts), which turn
// them into walk, interact, skip and confirm by where the game is; the thumbs are heard and drawn by goosethumbs.ts. The
// walk sends the holder as the camera sees the ground: up the screen is -z. Q and E, debug keys, turn the torch's reach
// up and down while held, as its slider does.
import type { Settings } from '../settings'
import { type Opening, SKIP_HOLD } from '../game/opening'
import type { Ending } from '../game/ending'
import { GooseControls, type ControlsState, type Commands, SPACE, WALK_KEYS } from './goosecontrols'
import { phone, filming, touchOn } from '../game/address'
import { createThumbs } from './goosethumbs'

/** The debug keys that turn the torch's reach up and down, and how many metres a second of one adds or takes. */
export const DIAL: Record<string, number> = { KeyQ: 1, KeyE: -1 }
export const DIAL_RATE = 1.2

/** The input, on what the page has made; `editing` whether the edit mode has the page, `setPaused` the game's pause. */
export function createGooseInput({ settings, opening, ending, editing, setPaused }: {
  settings: Settings
  opening: Opening
  ending: Ending
  editing: () => boolean | undefined
  setPaused: (on: boolean) => void
}) {
  const pressed = new Set<string>()
  /** The keys gone down since the last frame, repeats left out, and whether the page was clicked: what tells the controls the keyboard is in use. */
  const keysDown = new Set<string>()
  let clicked = false
  const gooseControls = new GooseControls(phone ? 'touch' : 'keyboard')
  /** The thumbs on a touch screen, in A Goose Tale with the phone version on; none filmed. */
  const thumbs = !filming && touchOn ? createThumbs(() => setPaused(true)) : undefined
  /** The screen, as the controls read the thumbs on it. */
  const viewport = () => ({ width: innerWidth, height: innerHeight })
  /** Whether the game was paused as of the last frame of the controls. */
  let pausedWas = false
  /** Where the game is, for the controls: nothing goes through in edit mode (which pauses) or typing in a field. */
  function controlsState(loading: boolean): ControlsState {
    if (editing() || document.activeElement instanceof HTMLInputElement) return 'none'
    if (loading) return 'loading'
    if (settings.paused) return 'paused'
    if (opening.running()) return 'opening'
    if (ending.running()) return ending.againShown() ? 'playAgain' : 'ending'
    return 'play'
  }
  /** The controls' input.commands for this frame, from the keys and the pads as they now are. */
  function controlsFrame(loading: boolean) {
    const pads = navigator.getGamepads?.() ?? []
    // Paused, every thumb let go, so none still down walks him once it goes on.
    if (settings.paused && !pausedWas) thumbs?.letGo()
    pausedWas = settings.paused
    const { touches, tapped } = thumbs?.take() ?? { touches: [], tapped: false }
    const state = controlsState(loading)
    input.commands = gooseControls.frame({ keys: pressed, pressed: keysDown, clicked, pads, touches, tapped, viewport: viewport(), state })
    keysDown.clear()
    clicked = false
    // The stick and the button drawn on a phone, or wherever touch is in use, each only where it does something: the
    // words Resume and Play again are buttons themselves, and a second there would be one too many.
    const touchShown = !!thumbs && (phone || input.commands.device === 'touch')
    input.thumbsShown = touchShown && (state === 'opening' || state === 'play')
    thumbs?.draw(gooseControls.thumbs, { stick: touchShown && state === 'play', button: input.thumbsShown, pause: touchShown && (state === 'opening' || state === 'play' || state === 'ending') }, state === 'opening' ? opening.skipHolding / SKIP_HOLD : 0)
  }
  const input = {
    /** The keys held. */
    pressed,
    viewport,
    /** What the player asks of the game this frame, from the controls. */
    commands: gooseControls.frame({ keys: pressed, pressed: keysDown, clicked, pads: [], touches: [], tapped: false, viewport: viewport(), state: 'none' }) as Commands,
    /** Whether the touch stick and button are drawn this frame. */
    thumbsShown: false,
    /** The pause screen's sound key, which takes Enter and Space for itself: elsewhere there they resume. */
    soundKey: undefined as HTMLButtonElement | undefined,
    frame: controlsFrame,
  }
  // Captured on the way down: lil-gui stops keys from bubbling out of the panel.
  addEventListener(
    'keydown',
    (event) => {
      if (event.target instanceof HTMLInputElement) return
      if (event.target === input.soundKey && (event.code === 'Enter' || event.code === 'NumpadEnter' || event.code === SPACE)) return
      if (!event.repeat) keysDown.add(event.code)
      if (!(event.code in WALK_KEYS) && !(event.code in DIAL) && event.code !== SPACE) return
      // A panel button last clicked keeps the focus, and Space would press it. Before the play, the loading screen's
      // Enter keeps its focus.
      if (event.code === SPACE && !opening.running() && document.activeElement instanceof HTMLElement) document.activeElement.blur()
      event.preventDefault()
      pressed.add(event.code)
    },
    { capture: true },
  )
  addEventListener('keyup', (event) => pressed.delete(event.code), { capture: true })
  // Keys released while the page had no focus never send their keyup.
  addEventListener('blur', () => pressed.clear())
  // A touch is no click: it puts the controls on touch.
  addEventListener('pointerdown', (event) => event.pointerType !== 'touch' && (clicked = true), { capture: true })
  return input
}

/** The input as the page has it. */
export type PlayerInput = ReturnType<typeof createGooseInput>
