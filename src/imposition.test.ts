import { expect, test } from 'vitest'
import { blankCount, impose } from './imposition'

test('16 pages, 4 sheets/signature: classic layout (0-based indices)', () => {
  const s = impose(16, 4)
  expect(s).toHaveLength(4)
  expect(s[0]).toEqual({ signature: 1, sheet: 1, front: [15, 0], back: [1, 14] })
  expect(s[3]).toEqual({ signature: 1, sheet: 4, front: [9, 6], back: [7, 8] })
})

test('pads to multiple of 4 with blanks at the end', () => {
  const s = impose(5, 4) // 8 slots, one 2-sheet signature
  expect(s).toHaveLength(2)
  expect(s[0].front).toEqual([null, 0])
  expect(s[0].back).toEqual([1, null])
  expect(blankCount(5)).toBe(3)
  expect(blankCount(8)).toBe(0)
})

test('single page', () => {
  expect(impose(1, 4)).toEqual([{ signature: 1, sheet: 1, front: [null, 0], back: [null, null] }])
})

test('last signature is shorter, every page appears exactly once', () => {
  for (const [n, k] of [[37, 4], [100, 5], [3, 1], [64, 8]]) {
    const s = impose(n, k)
    const seen = s.flatMap(x => [...x.front, ...x.back]).filter(p => p !== null)
    expect(seen.sort((a, b) => a! - b!)).toEqual([...Array(n).keys()])
    expect(s.length).toBe(Math.ceil(n / 4))
  }
  const s = impose(40, 4) // 16 + 16 + 8
  expect(s.map(x => x.signature)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3])
  expect(s[8].front).toEqual([39, 32])
})

test('rejects bad input', () => {
  expect(() => impose(0, 4)).toThrow()
  expect(() => impose(10, 0)).toThrow()
})
