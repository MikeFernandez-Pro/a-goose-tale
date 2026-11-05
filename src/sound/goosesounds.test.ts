// The formats a sound is asked for in, best first, and that each is there to be fetched.
import { existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatsOf, GOOSE_SOUNDS, soundFile, takesOf } from './goosesounds'

describe("a sound's formats", () => {
  it('ask for a loop as it was made, then as mp3', () => {
    expect(formatsOf('wind')).toEqual(['ogg', 'mp3'])
    expect(formatsOf('swarm_edge')).toEqual(['ogg', 'mp3'])
    expect(formatsOf('winch')).toEqual(['ogg', 'mp3'])
  })

  it("go by the sound, so one sharing another's file asks as that one does", () => {
    expect(formatsOf('torch')).toEqual(formatsOf('fire_calm'))
  })

  it('leave what is already mp3 alone', () => {
    expect(formatsOf('music')).toEqual(['mp3'])
    expect(formatsOf('honk')).toEqual(['mp3'])
  })

  it('are all in public/sounds/goose', () => {
    const missing = GOOSE_SOUNDS.flatMap((sound) => takesOf(sound).flatMap((take) => formatsOf(sound).map((format) => soundFile(sound, take, format)))).filter((name) => !existsSync(`public/sounds/goose/${name}`))
    expect(missing).toEqual([])
  })
})
