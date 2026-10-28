import { describe, expect, it } from 'vitest'
import { calculateQuote } from './money'

describe('calculateQuote', () => {
  it('uses decimal-safe arithmetic', () => {
    expect(calculateQuote('500', '2.25', '10')).toEqual({ baseAmount: '1125.00', total: '1135.00' })
  })

  it('does not leak binary floating point artefacts', () => {
    expect(calculateQuote('0.1', '0.2', '0.1')).toEqual({ baseAmount: '0.02', total: '0.12' })
  })
})
