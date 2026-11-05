// F and P, with the panel or without one.
import type { Settings } from './panel'

/**
 * The torch put out and relit, and the pause, as F and P do them and the
 * panel's buttons do: for a page with the panel or without one. F is a debug
 * key, and does nothing unless the debug keys are on; the button always
 * works. `changed` after the light; `labelled` after either, for a panel's
 * buttons to read right.
 */
export function lightAndPause(settings: Settings, changed: () => void, labelled: () => void = () => {}): { toggleLight(): void; togglePause(): void } {
  const actions = {
    toggleLight() {
      settings.on = !settings.on
      labelled()
      changed()
    },
    togglePause() {
      settings.paused = !settings.paused
      labelled()
    },
  }
  // Captured on the way down: lil-gui stops keys from bubbling out of the panel.
  addEventListener(
    'keydown',
    (event) => {
      if ((event.code !== 'KeyF' && event.code !== 'KeyP') || event.repeat) return
      if (event.code === 'KeyF' && !settings.debug) return
      // Whatever in the panel was last clicked keeps the focus, and would take
      // the key as typing: a number field would read the letter.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      event.preventDefault()
      if (event.code === 'KeyF') actions.toggleLight()
      else actions.togglePause()
    },
    { capture: true },
  )
  return actions
}
