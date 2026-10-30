import { PDFDocument, StandardFonts, rgb, type PDFEmbeddedPage } from 'pdf-lib'
import { impose } from './imposition'

const MM = 72 / 25.4
export const PAPER = { A4: [841.89, 595.28], Letter: [792, 612] } as const // landscape, pt

export type ExportMode = 'duplex' | 'fronts' | 'backs'

export interface ImposeOptions {
  sheetsPerSignature: number
  paper: keyof typeof PAPER
  gutterMm: number // gap between each page and the fold
  marginMm: number // outer margin on the sheet
  labels: boolean
  keep?: number[] // source page indices to print, in order; default all
  mode?: ExportMode // default 'duplex'
}

/** Returns a duplex-ready PDF: sheet 1 front, sheet 1 back, sheet 2 front, ... */
export async function imposePdf(src: Uint8Array | ArrayBuffer, o: ImposeOptions): Promise<Uint8Array> {
  const source = await PDFDocument.load(src)
  const keep = o.keep ?? source.getPageIndices()
  if (keep.length === 0) throw new Error('No pages selected')

  const out = await PDFDocument.create()
  const font = await out.embedFont(StandardFonts.Helvetica)
  const embedded = await out.embedPages(keep.map(i => source.getPage(i)))
  const [W, H] = PAPER[o.paper]
  const g = o.gutterMm * MM, m = o.marginMm * MM
  const boxW = W / 2 - g - m, boxH = H - 2 * m
  if (boxW <= 0 || boxH <= 0) throw new Error('Margins too large for paper')

  const place = (sheet: ReturnType<typeof out.addPage>, p: PDFEmbeddedPage, left: boolean) => {
    const s = Math.min(boxW / p.width, boxH / p.height)
    const w = p.width * s, h = p.height * s
    // hug the fold so the gutter is exact; extra space goes to the outer edge
    sheet.drawPage(p, { x: left ? W / 2 - g - w : W / 2 + g, y: (H - h) / 2, width: w, height: h })
  }

  const mode = o.mode ?? 'duplex'
  for (const sh of impose(keep.length, o.sheetsPerSignature)) {
    const sides: Array<[typeof sh.front, 'FRONT' | 'BACK']> =
      mode === 'fronts' ? [[sh.front, 'FRONT']] :
      mode === 'backs' ? [[sh.back, 'BACK']] :
      [[sh.front, 'FRONT'], [sh.back, 'BACK']]

    for (const [side, name] of sides) {
      const page = out.addPage([W, H])
      if (side[0] !== null) place(page, embedded[side[0]], true)
      if (side[1] !== null) place(page, embedded[side[1]], false)
      if (o.labels) {
        page.drawText(`Signature ${sh.signature} · Sheet ${sh.sheet} · ${name}`, { x: 12, y: 8, size: 7, font, color: rgb(0.5, 0.5, 0.5) })
        // fold marks
        page.drawLine({ start: { x: W / 2, y: H }, end: { x: W / 2, y: H - 10 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })
        page.drawLine({ start: { x: W / 2, y: 0 }, end: { x: W / 2, y: 10 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) })
      }
    }
  }
  return out.save()
}
