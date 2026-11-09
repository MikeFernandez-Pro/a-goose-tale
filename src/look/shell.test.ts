// The shell's sheen, highlight and rim: in its shader only while each is more than 0.
import { describe, expect, it } from 'vitest'
import { ShellToonMaterial, type ShellLook } from './shell'

const matt: ShellLook = { sheen: 0, specular: 0, shininess: 30, softness: 0.05, specularColor: 0xffffff, rim: false, rimStrength: 0.5, rimWidth: 0.3, rimSoftness: 0, rimColor: 0xffffff }

describe('a shell', () => {
  it('draws no sheen, highlight or rim at 0', () => {
    const shell = new ShellToonMaterial()
    shell.set(matt)
    expect([shell.withSheen, shell.withHighlight, shell.withRim]).toEqual([false, false, false])
  })

  it('is built again once a term goes over 0, and not when it stays there', () => {
    const shell = new ShellToonMaterial()
    shell.set(matt)
    const was = shell.version
    shell.set({ ...matt, specular: 1.2, rim: true })
    expect([shell.withSheen, shell.withHighlight, shell.withRim]).toEqual([false, true, true])
    expect(shell.version).toBeGreaterThan(was)
    const built = shell.version
    shell.set({ ...matt, specular: 2, rim: true })
    expect(shell.version).toBe(built)
  })

  it('turns a term on or off on every shell of its look', () => {
    const whole = new ShellToonMaterial()
    const zone = new ShellToonMaterial({ sharing: whole })
    const was = zone.version
    whole.set({ ...matt, sheen: 0.2 })
    expect(zone.withSheen).toBe(true)
    expect(zone.version).toBeGreaterThan(was)
  })
})
