import { PDFDocument } from 'pdf-lib'
import { expect, test } from 'vitest'
import { LEAF_PRESETS } from './coverGeometry'
import { generateCoverPdf } from './coverPdf'

test('generates single-sheet paperback cover PDF', async () => {
  const bytes = await generateCoverPdf({
    spec: {
      coverType: 'paperback',
      leafWidthMm: LEAF_PRESETS.A5.widthMm,
      leafHeightMm: LEAF_PRESETS.A5.heightMm,
      pageCount: 160,
    },
    imageMode: 'front',
    paperName: 'A3',
  })

  expect(bytes).toBeInstanceOf(Uint8Array)
  const doc = await PDFDocument.load(bytes)
  expect(doc.getPageCount()).toBe(1)
  const { width, height } = doc.getPage(0).getSize()
  // A3 in points is approx 420 * (72 / 25.4) = 1190.55 pt
  expect(Math.round(width)).toBe(1191)
  expect(Math.round(height)).toBe(842)
})

test('generates single-sheet hardcover cover PDF with guides', async () => {
  const bytes = await generateCoverPdf({
    spec: {
      coverType: 'hardcover',
      leafWidthMm: LEAF_PRESETS.A5.widthMm,
      leafHeightMm: LEAF_PRESETS.A5.heightMm,
      pageCount: 200,
    },
    imageMode: 'wrap',
    paperName: 'A3',
  })

  const doc = await PDFDocument.load(bytes)
  expect(doc.getPageCount()).toBe(1)
})

test('generates 2-piece split cover PDF for A4 printing', async () => {
  const bytes = await generateCoverPdf({
    spec: {
      coverType: 'hardcover',
      leafWidthMm: LEAF_PRESETS.A5.widthMm,
      leafHeightMm: LEAF_PRESETS.A5.heightMm,
      pageCount: 200,
    },
    imageMode: 'front',
    splitTwoSheets: true,
    paperName: 'A4',
  })

  const doc = await PDFDocument.load(bytes)
  // Should produce 2 pages (Page 1 = Back + Glue flap, Page 2 = Spine + Front)
  expect(doc.getPageCount()).toBe(2)
})
