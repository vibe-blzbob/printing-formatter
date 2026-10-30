import { expect, test } from 'vitest'
import { calculateSpineWidth, computeCoverGeometry, LEAF_PRESETS } from './coverGeometry'

test('calculates spine width based on page count and paper caliper', () => {
  // 200 pages = 100 leaves * 0.09mm = 9.0mm
  expect(calculateSpineWidth(200, 0.09)).toBe(9.0)
  // small page count has minimum threshold of 3mm
  expect(calculateSpineWidth(10, 0.09)).toBe(3.0)
})

test('computes paperback geometry with 3mm bleed', () => {
  const geo = computeCoverGeometry({
    coverType: 'paperback',
    leafWidthMm: LEAF_PRESETS.A5.widthMm, // 148.5
    leafHeightMm: LEAF_PRESETS.A5.heightMm, // 210.0
    pageCount: 200,
    spineOverrideMm: 10,
  })

  // Total width = 3 + 148.5 + 10 + 148.5 + 3 = 313mm
  expect(geo.totalWidthMm).toBe(313)
  // Total height = 210 + 6 = 216mm
  expect(geo.totalHeightMm).toBe(216)
  // 313mm width exceeds A4 (297mm) and Letter (279.4mm)
  expect(geo.fitsOnA4).toBe(false)
  expect(geo.fitsOnLetter).toBe(false)
  // Fits on A3 (420 x 297mm)
  expect(geo.bestPaperFit?.name).toBe('A3')
})

test('computes hardcover geometry with squares, hinges, and turnover wrap', () => {
  const geo = computeCoverGeometry({
    coverType: 'hardcover',
    leafWidthMm: LEAF_PRESETS.A5.widthMm, // 148.5
    leafHeightMm: LEAF_PRESETS.A5.heightMm, // 210.0
    pageCount: 200,
    spineOverrideMm: 12,
    turnoverMm: 20,
  })

  // board width = 148.5 + 3 = 151.5
  // board height = 210 + 6 = 216
  // total width = 2*20 + 2*151.5 + 2*8 + 12 = 40 + 303 + 16 + 12 = 371mm
  expect(geo.totalWidthMm).toBe(371)
  // total height = 216 + 2*20 = 256mm
  expect(geo.totalHeightMm).toBe(256)
  // Fits on A3
  expect(geo.bestPaperFit?.name).toBe('A3')
})
