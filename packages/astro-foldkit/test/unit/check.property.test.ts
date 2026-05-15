import { describe, expect, it } from 'bun:test'
import fc from 'fast-check'
import { check } from '../../src/server'

describe('check — properties', () => {
  it('always returns a boolean for any input', async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (value) => {
        const result = await check(value)
        expect(typeof result).toBe('boolean')
      }),
    )
  })

  it('rejects all primitives', async () => {
    const primitive = fc.oneof(fc.string(), fc.integer(), fc.float(), fc.boolean(), fc.bigInt())
    await fc.assert(
      fc.asyncProperty(primitive, async (value) => {
        expect(await check(value)).toBe(false)
      }),
    )
  })

  it('rejects null and undefined', async () => {
    for (const value of [null, undefined]) {
      expect(await check(value)).toBe(false)
    }
  })

  it('rejects any object missing __foldkit', async () => {
    const withoutFlag = fc.dictionary(
      fc.string().filter((k) => k !== '__foldkit'),
      fc.anything(),
    )
    await fc.assert(
      fc.asyncProperty(withoutFlag, async (obj) => {
        expect(await check(obj)).toBe(false)
      }),
    )
  })

  it('rejects any object with __foldkit !== true', async () => {
    const notTrue = fc.oneof(
      fc.constant(false),
      fc.constant(null),
      fc.string(),
      fc.integer(),
      fc.float(),
    )
    await fc.assert(
      fc.asyncProperty(notTrue, async (flag) => {
        expect(await check({ __foldkit: flag })).toBe(false)
      }),
    )
  })

  it('accepts any object carrying __foldkit: true', async () => {
    const withFlag = fc
      .dictionary(
        fc.string().filter((k) => k !== '__foldkit'),
        fc.anything(),
      )
      .map((extra) => ({ __foldkit: true as const, ...extra }))
    await fc.assert(
      fc.asyncProperty(withFlag, async (obj) => {
        expect(await check(obj)).toBe(true)
      }),
    )
  })

  it('accepts any function carrying __foldkit: true', async () => {
    await fc.assert(
      fc.asyncProperty(fc.func(fc.anything()), async (fn) => {
        const tagged = Object.assign(fn, { __foldkit: true as const })
        expect(await check(tagged)).toBe(true)
      }),
    )
  })
})
