// The game paused, as the player sees it.
import type { PlayerInput } from './gooseinput'
import { type Settings } from '../settings'
import { type GooseSounds } from '../sound/goosesounds'
import { filming } from '../game/address'
import { type PadButton, padBeside, besideOf } from './holdhint'
/**
 * The game paused (#197), by Escape, P, Start, losing the window or the pad in use unplugged: a dark veil over it, as the
 * loading screen and the ending's card are ink on black, "paused" on it in the hints' hand, and under it Resume, as the
 * loading screen's Enter is drawn, the pad's button beside it on a pad. Resume clicked, or Escape, Start or the bottom
 * face button again, it goes on. Not in edit mode, which pauses as well, nor filmed.
 */
export function createPauseVeil({ settings, input, gooseSounds, loaded, editing, setPaused }: {
  settings: Settings
  input: PlayerInput
  gooseSounds: GooseSounds | undefined
  loaded: () => boolean
  editing: () => boolean | undefined
  setPaused: (on: boolean) => void
}) {
  const pauseVeil = filming ? undefined : document.createElement('div')
  let resumePad: PadButton | undefined
  let resumeKey: HTMLButtonElement | undefined
  if (pauseVeil) {
    pauseVeil.style.cssText = 'position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;background:#0009;opacity:0;transition:opacity 0.2s;pointer-events:none;visibility:hidden;z-index:25;font-family:Gaegu,cursive;font-weight:700;color:#f6ead0;text-shadow:0 2px 4px #000c'
    const word = document.createElement('div')
    word.textContent = 'paused'
    word.style.cssText = 'font-size:min(11vw,104px);line-height:1'
    const resume = document.createElement('button')
    resume.className = 'enter'
    resume.textContent = 'Resume'
    resumePad = padBeside(resume)
    resume.addEventListener('click', () => setPaused(false))
    resumeKey = resume
    pauseVeil.setAttribute('role', 'dialog')
    pauseVeil.setAttribute('aria-label', 'Paused')
    pauseVeil.append(word, resume)
    // M's work where there is no M: a phone, or a player on the mouse.
    if (gooseSounds) {
      const sounds = gooseSounds
      const key = document.createElement('button')
      key.className = 'enter'
      key.addEventListener('click', () => (sounds.muted = !sounds.muted))
      pauseVeil.append(key)
      input.soundKey = key
    }
    document.body.append(pauseVeil)
  }
  /** Whether the veil showed last frame. */
  let veilShown = false
  /** The veil over the paused game, focus on Resume while it shows, and Resume's button as the device last used has it. */
  function pauseFrame() {
    if (!pauseVeil) return
    const shown = settings.paused && loaded() && !editing()
    pauseVeil.style.opacity = shown ? '1' : '0'
    pauseVeil.style.pointerEvents = shown ? 'auto' : 'none'
    if (shown !== veilShown) {
      veilShown = shown
      // Hidden once it has faded, out of Tab's way and a screen reader's.
      pauseVeil.style.transition = shown ? 'opacity 0.2s' : 'opacity 0.2s,visibility 0s 0.2s'
      pauseVeil.style.visibility = shown ? 'visible' : 'hidden'
      if (shown) resumeKey?.focus({ preventScroll: true })
      else if (document.activeElement instanceof HTMLElement && pauseVeil.contains(document.activeElement)) document.activeElement.blur()
    }
    if (input.soundKey && gooseSounds) {
      const says = gooseSounds.muted ? 'Sound off' : 'Sound on'
      if (input.soundKey.textContent !== says) input.soundKey.textContent = says
    }
    resumePad?.update(besideOf(input.commands))
  }
  return { element: pauseVeil, frame: pauseFrame }
}
