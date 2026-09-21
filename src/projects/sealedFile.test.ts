import { describe, expect, it } from 'vitest'
import { isSealed, MAX_ITERATIONS, sealBytes, SEAL_ITERATIONS, unsealBytes } from './sealedFile'
import { isZip } from './workingFile'

/** Enough rounds to be a real derivation, few enough for a fast loop. */
const QUICK = { iterations: 1_000 }

const plain = new TextEncoder().encode('PK pretend this is a zip of the organisation')

describe('sealBytes / unsealBytes', () => {
  it('round-trips under the password, and is not a zip on the outside', async () => {
    const sealed = await sealBytes(plain, 'correct horse', QUICK)
    expect(isSealed(sealed)).toBe(true)
    expect(isZip(sealed)).toBe(false)
    expect(await unsealBytes(sealed, 'correct horse')).toEqual(plain)
  })

  it('answers nothing for a wrong password, and nothing for a damaged file', async () => {
    const sealed = await sealBytes(plain, 'correct horse', QUICK)
    expect(await unsealBytes(sealed, 'incorrect horse')).toBeUndefined()
    const damaged = sealed.slice()
    damaged[damaged.length - 1] ^= 0xff
    expect(await unsealBytes(damaged, 'correct horse')).toBeUndefined()
  })

  it('does not let a header be lowered after the fact', async () => {
    // The header is the cipher's additional data: a count written down to one
    // so a guess is cheap fails with the body, rather than deriving a weak key.
    const sealed = await sealBytes(plain, 'correct horse', QUICK)
    const lowered = sealed.slice()
    new DataView(lowered.buffer).setUint32(14, 1)
    expect(await unsealBytes(lowered, 'correct horse')).toBeUndefined()
  })

  it('refuses a header that asks for more rounds than any build would write', async () => {
    const sealed = await sealBytes(plain, 'correct horse', QUICK)
    const hostage = sealed.slice()
    new DataView(hostage.buffer).setUint32(14, MAX_ITERATIONS + 1)
    expect(await unsealBytes(hostage, 'correct horse')).toBeUndefined()
  })

  it('never writes the same bytes twice, even for the same zip and password', async () => {
    const one = await sealBytes(plain, 'correct horse', QUICK)
    const two = await sealBytes(plain, 'correct horse', QUICK)
    expect(one).not.toEqual(two)
  })

  it('reads nothing that does not start its way, and refuses a version it does not know', async () => {
    expect(isSealed(plain)).toBe(false)
    expect(isSealed(new Uint8Array(0))).toBe(false)
    expect(await unsealBytes(plain, 'anything')).toBeUndefined()
    const later = (await sealBytes(plain, 'correct horse', QUICK)).slice()
    later[13] = 2
    expect(await unsealBytes(later, 'correct horse')).toBeUndefined()
  })

  it('writes the count this build stands on', async () => {
    const sealed = await sealBytes(plain, 'correct horse')
    expect(new DataView(sealed.buffer).getUint32(14)).toBe(SEAL_ITERATIONS)
    expect(await unsealBytes(sealed, 'correct horse')).toEqual(plain)
  })
})
