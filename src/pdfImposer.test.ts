import { PDFDocument } from 'pdf-lib'
import { expect, test } from 'vitest'
import { PAPER, imposePdf } from './pdfImposer'

async function makePdf(n: number) {
  const d = await PDFDocument.create()
  for (let i = 0; i < n; i++) d.addPage([420, 595]).drawText(`Page ${i + 1}`, { x: 50, y: 500 })
  return d.save()
}

const opts = { sheetsPerSignature: 4, paper: 'A4' as const, gutterMm: 8, marginMm: 10, labels: true }

test('10 pages -> 3 sheets -> 6 landscape sides', async () => {
  const out = await PDFDocument.load(await imposePdf(await makePdf(10), opts))
  expect(out.getPageCount()).toBe(6)
  const { width, height } = out.getPage(0).getSize()
  expect([width, height]).toEqual([...PAPER.A4])
})

test('keep filters pages (deletion)', async () => {
  const out = await PDFDocument.load(await imposePdf(await makePdf(10), { ...opts, keep: [0, 1, 2, 3] }))
  expect(out.getPageCount()).toBe(2)
})

test('supports split fronts and backs export', async () => {
  const src = await makePdf(12) // 3 sheets -> 6 sides
  const fronts = await PDFDocument.load(await imposePdf(src, { ...opts, mode: 'fronts' }))
  const backs = await PDFDocument.load(await imposePdf(src, { ...opts, mode: 'backs' }))
  expect(fronts.getPageCount()).toBe(3)
  expect(backs.getPageCount()).toBe(3)
})

test('errors on empty selection and impossible margins', async () => {
  const src = await makePdf(4)
  await expect(imposePdf(src, { ...opts, keep: [] })).rejects.toThrow('No pages')
  await expect(imposePdf(src, { ...opts, marginMm: 200 })).rejects.toThrow('Margins')
})
