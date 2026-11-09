// The shell's highlight, rim and painted normals' rounding: in its shader only while each is more than 0.
import { Texture } from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'
import { ShellToonMaterial, type PaintLook, type ShellLook } from './shell'

// The strokes are drawn on a canvas, which the tests have none of: a blank texture stands in.
vi.mock('./strokes', () => ({ strokesAt: () => new Texture() }))

const matt: ShellLook = { specular: 0, shininess: 30, softness: 0.05, specularColor: 0xffffff, rim: false, rimStrength: 0.5, rimWidth: 0.3, rimSoftness: 0, rimColor: 0xffffff }
const flat: PaintLook = { strength: 1, density: 2, size: 1, rounding: 0 }

describe('a shell', () => {
  it('draws no highlight or rim at 0', () => {
    const shell = new ShellToonMaterial()
    shell.set(matt)
    expect([shell.withHighlight, shell.withRim]).toEqual([false, false])
  })

  it('is built again once a term goes over 0, and not when it stays there', () => {
    const shell = new ShellToonMaterial()
    shell.set(matt)
    const was = shell.version
    shell.set({ ...matt, specular: 1.2, rim: true })
    expect([shell.withHighlight, shell.withRim]).toEqual([true, true])
    expect(shell.version).toBeGreaterThan(was)
    const built = shell.version
    shell.set({ ...matt, specular: 2, rim: true })
    expect(shell.version).toBe(built)
  })

  it('turns a term on or off on every shell of its look', () => {
    const whole = new ShellToonMaterial()
    const zone = new ShellToonMaterial({ sharing: whole })
    const was = zone.version
    whole.set({ ...matt, rim: true })
    expect(zone.withRim).toBe(true)
    expect(zone.version).toBeGreaterThan(was)
  })

  it('bends its painted normal toward up only while the rounding is more than 0', () => {
    const shell = new ShellToonMaterial({ painted: { extent: 1 } })
    shell.setPaint(flat)
    expect(shell.withRounding).toBe(false)
    const straight = shell.normalNode
    const was = shell.version
    shell.setPaint({ ...flat, rounding: 0.01 })
    expect(shell.withRounding).toBe(true)
    expect(shell.normalNode).not.toBe(straight)
    expect(shell.version).toBeGreaterThan(was)
    const built = shell.version
    shell.setPaint({ ...flat, rounding: 0.5 })
    expect(shell.version).toBe(built)
    shell.setPaint(flat)
    expect(shell.withRounding).toBe(false)
    expect(shell.normalNode).toBe(straight)
  })

  it('turns the rounding on or off on every shell of its look', () => {
    const whole = new ShellToonMaterial({ painted: { extent: 1 } })
    const zone = new ShellToonMaterial({ sharing: whole, painted: { extent: 1 } })
    const was = zone.version
    whole.setPaint({ ...flat, rounding: 0.01 })
    expect(zone.withRounding).toBe(true)
    expect(zone.version).toBeGreaterThan(was)
  })

  it('leaves the normal of a shell made without painted normals as it is', () => {
    const shell = new ShellToonMaterial()
    shell.setPaint({ ...flat, rounding: 0.01 })
    expect(shell.normalNode).toBeNull()
  })
})
