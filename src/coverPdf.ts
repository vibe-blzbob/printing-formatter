import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib'
import { computeCoverGeometry, STANDARD_PAPERS, type CoverSpec } from './coverGeometry'

const MM_TO_PT = 72 / 25.4

export interface CoverPdfOptions {
  spec: CoverSpec
  imageBytes?: Uint8Array | ArrayBuffer | null
  imageMode: 'front' | 'wrap'
  paperName?: string // default to bestPaperFit or 'A3'
  splitTwoSheets?: boolean // true = export 2-piece split (A4/Letter)
  bgColorHex?: string // default #23201e
}

function hexToRgb(hex: string) {
  const clean = hex.replace('#', '')
  const num = parseInt(clean, 16)
  return rgb(((num >> 16) & 255) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255)
}

export async function generateCoverPdf(options: CoverPdfOptions): Promise<Uint8Array> {
  const geo = computeCoverGeometry(options.spec)
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold)

  // Embed image if provided
  let embeddedImg = null
  if (options.imageBytes) {
    const bytes = options.imageBytes instanceof Uint8Array ? options.imageBytes : new Uint8Array(options.imageBytes)
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    try {
      embeddedImg = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes)
    } catch {
      // Fallback: try embedding as jpg if png fails
      try {
        embeddedImg = await doc.embedJpg(bytes)
      } catch {
        embeddedImg = null
      }
    }
  }

  const bgRgb = hexToRgb(options.bgColorHex || '#23201e')
  const guideRgb = rgb(0.5, 0.5, 0.5)
  const textRgb = rgb(0.4, 0.4, 0.4)

  if (options.splitTwoSheets) {
    // 2-Piece Split on A4 or Letter
    const paper = STANDARD_PAPERS.find(p => p.name === (options.paperName || 'A4')) || STANDARD_PAPERS[1]
    const pageW = paper.widthMm * MM_TO_PT
    const pageH = paper.heightMm * MM_TO_PT

    // Sheet 1: Back Cover + 15mm Glue Flap
    const glueFlapMm = 15.0
    const piece1WidthMm = geo.backWidthMm + (geo.coverType === 'hardcover' ? geo.turnoverMm : geo.bleedMm) + glueFlapMm
    const piece1HeightMm = geo.totalHeightMm

    const page1 = doc.addPage([pageW, pageH])
    const p1OffsetX = (pageW - piece1WidthMm * MM_TO_PT) / 2
    const p1OffsetY = (pageH - piece1HeightMm * MM_TO_PT) / 2

    // Background
    page1.drawRectangle({
      x: p1OffsetX,
      y: p1OffsetY,
      width: piece1WidthMm * MM_TO_PT,
      height: piece1HeightMm * MM_TO_PT,
      color: bgRgb,
    })

    // Glue flap zone
    const flapX = p1OffsetX + (piece1WidthMm - glueFlapMm) * MM_TO_PT
    page1.drawRectangle({
      x: flapX,
      y: p1OffsetY,
      width: glueFlapMm * MM_TO_PT,
      height: piece1HeightMm * MM_TO_PT,
      color: rgb(0.2, 0.2, 0.2),
    })
    page1.drawLine({
      start: { x: flapX, y: p1OffsetY },
      end: { x: flapX, y: p1OffsetY + piece1HeightMm * MM_TO_PT },
      color: rgb(0.8, 0.8, 0.8),
      thickness: 1,
      dashArray: [4, 4],
    })
    page1.drawText('GLUE FLAP (Overlap with Sheet 2)', {
      x: flapX + 4,
      y: p1OffsetY + 20,
      font,
      size: 7,
      color: rgb(0.8, 0.8, 0.8),
      rotate: { angle: 90, type: 'degrees' } as never,
    })

    page1.drawText(`BACK COVER · Sheet 1 of 2 (${geo.coverType.toUpperCase()})`, {
      x: p1OffsetX + 10,
      y: p1OffsetY + 10,
      font: fontBold,
      size: 8,
      color: textRgb,
    })

    // Sheet 2: Spine + Front Cover
    const piece2WidthMm = geo.spineWidthMm + geo.frontWidthMm + (geo.coverType === 'hardcover' ? geo.turnoverMm + 2 * geo.hingeGapMm : geo.bleedMm)
    const page2 = doc.addPage([pageW, pageH])
    const p2OffsetX = (pageW - piece2WidthMm * MM_TO_PT) / 2
    const p2OffsetY = (pageH - piece1HeightMm * MM_TO_PT) / 2

    // Background
    page2.drawRectangle({
      x: p2OffsetX,
      y: p2OffsetY,
      width: piece2WidthMm * MM_TO_PT,
      height: piece1HeightMm * MM_TO_PT,
      color: bgRgb,
    })

    // If front image is supplied, place on front cover area of sheet 2
    const frontAreaW = geo.frontWidthMm * MM_TO_PT
    const frontAreaH = geo.coverHeightMm * MM_TO_PT
    const frontX = p2OffsetX + (geo.coverType === 'hardcover' ? geo.spineWidthMm + geo.hingeGapMm : geo.spineWidthMm) * MM_TO_PT
    const frontY = p2OffsetY + (geo.coverType === 'hardcover' ? geo.turnoverMm : geo.bleedMm) * MM_TO_PT

    if (embeddedImg) {
      page2.drawImage(embeddedImg, { x: frontX, y: frontY, width: frontAreaW, height: frontAreaH })
    }

    page2.drawText(`FRONT & SPINE · Sheet 2 of 2 (${geo.coverType.toUpperCase()})`, {
      x: p2OffsetX + 10,
      y: p2OffsetY + 10,
      font: fontBold,
      size: 8,
      color: textRgb,
    })

    return doc.save()
  }

  // Single full-sheet export
  const paper = STANDARD_PAPERS.find(p => p.name === options.paperName) || geo.bestPaperFit || STANDARD_PAPERS[3] // A3 default
  const pageW = paper.widthMm * MM_TO_PT
  const pageH = paper.heightMm * MM_TO_PT
  const wrapW = geo.totalWidthMm * MM_TO_PT
  const wrapH = geo.totalHeightMm * MM_TO_PT

  const page = doc.addPage([pageW, pageH])
  const offsetX = (pageW - wrapW) / 2
  const offsetY = (pageH - wrapH) / 2

  // Background
  page.drawRectangle({ x: offsetX, y: offsetY, width: wrapW, height: wrapH, color: bgRgb })

  // Place Image
  if (embeddedImg) {
    if (options.imageMode === 'wrap') {
      page.drawImage(embeddedImg, { x: offsetX, y: offsetY, width: wrapW, height: wrapH })
    } else {
      // Front cover only
      const frontX = offsetX + (geo.totalWidthMm - (geo.coverType === 'hardcover' ? geo.turnoverMm : geo.bleedMm) - geo.frontWidthMm) * MM_TO_PT
      const frontY = offsetY + (geo.coverType === 'hardcover' ? geo.turnoverMm : geo.bleedMm) * MM_TO_PT
      const frontW = geo.frontWidthMm * MM_TO_PT
      const frontH = geo.coverHeightMm * MM_TO_PT
      page.drawImage(embeddedImg, { x: frontX, y: frontY, width: frontW, height: frontH })
    }
  }

  // Draw Guidelines
  drawGuidelines(page, geo, offsetX, offsetY, font, fontBold, guideRgb, textRgb)

  return doc.save()
}

function drawGuidelines(
  page: PDFPage,
  geo: ReturnType<typeof computeCoverGeometry>,
  ox: number,
  oy: number,
  font: any,
  fontBold: any,
  guideColor: any,
  textColor: any,
) {
  const wrapW = geo.totalWidthMm * MM_TO_PT
  const wrapH = geo.totalHeightMm * MM_TO_PT

  // Outer trim cut box
  page.drawRectangle({
    x: ox,
    y: oy,
    width: wrapW,
    height: wrapH,
    borderColor: guideColor,
    borderWidth: 0.5,
  })

  if (geo.coverType === 'paperback') {
    const bleed = geo.bleedMm * MM_TO_PT
    const backW = geo.backWidthMm * MM_TO_PT
    const spineW = geo.spineWidthMm * MM_TO_PT

    // Spine score lines
    const spineLeftX = ox + bleed + backW
    const spineRightX = spineLeftX + spineW

    for (const x of [spineLeftX, spineRightX]) {
      page.drawLine({
        start: { x, y: oy },
        end: { x, y: oy + wrapH },
        color: guideColor,
        thickness: 0.5,
        dashArray: [4, 4],
      })
    }

    // Opening crease lines (5mm)
    const crease = 5.0 * MM_TO_PT
    page.drawLine({
      start: { x: spineLeftX - crease, y: oy },
      end: { x: spineLeftX - crease, y: oy + wrapH },
      color: rgb(0.7, 0.7, 0.7),
      thickness: 0.5,
      dashArray: [2, 4],
    })
    page.drawLine({
      start: { x: spineRightX + crease, y: oy },
      end: { x: spineRightX + crease, y: oy + wrapH },
      color: rgb(0.7, 0.7, 0.7),
      thickness: 0.5,
      dashArray: [2, 4],
    })

    // Labels
    page.drawText('BACK', { x: ox + bleed + 10, y: oy + wrapH - 15, font: fontBold, size: 8, color: textColor })
    page.drawText(`SPINE (${geo.spineWidthMm}mm)`, { x: spineLeftX + 2, y: oy + 20, font, size: 6, color: textColor, rotate: { angle: 90, type: 'degrees' } as never })
    page.drawText('FRONT', { x: spineRightX + 10, y: oy + wrapH - 15, font: fontBold, size: 8, color: textColor })
  } else {
    // Hardcover
    const t = geo.turnoverMm * MM_TO_PT
    const bW = geo.frontWidthMm * MM_TO_PT
    const h = geo.hingeGapMm * MM_TO_PT
    const spineW = geo.spineWidthMm * MM_TO_PT

    // Greyboard layout rectangles (dotted)
    const backBoardX = ox + t
    const boardY = oy + t
    const boardH = geo.coverHeightMm * MM_TO_PT

    // Back board
    page.drawRectangle({ x: backBoardX, y: boardY, width: bW, height: boardH, borderColor: guideColor, borderWidth: 0.5, borderDashArray: [3, 3] })
    // Spine board
    const spineX = backBoardX + bW + h
    page.drawRectangle({ x: spineX, y: boardY, width: spineW, height: boardH, borderColor: guideColor, borderWidth: 0.5, borderDashArray: [3, 3] })
    // Front board
    const frontBoardX = spineX + spineW + h
    page.drawRectangle({ x: frontBoardX, y: boardY, width: bW, height: boardH, borderColor: guideColor, borderWidth: 0.5, borderDashArray: [3, 3] })

    // Corner 45-degree cut lines
    const cornerCut = t * 0.7
    page.drawLine({ start: { x: ox, y: oy + cornerCut }, end: { x: ox + cornerCut, y: oy }, color: guideColor, thickness: 0.5 })
    page.drawLine({ start: { x: ox + wrapW - cornerCut, y: oy }, end: { x: ox + wrapW, y: oy + cornerCut }, color: guideColor, thickness: 0.5 })
    page.drawLine({ start: { x: ox, y: oy + wrapH - cornerCut }, end: { x: ox + cornerCut, y: oy + wrapH }, color: guideColor, thickness: 0.5 })
    page.drawLine({ start: { x: ox + wrapW - cornerCut, y: oy + wrapH }, end: { x: ox + wrapW, y: oy + wrapH - cornerCut }, color: guideColor, thickness: 0.5 })

    // Labels
    page.drawText('BACK BOARD', { x: backBoardX + 10, y: boardY + boardH - 15, font: fontBold, size: 8, color: textColor })
    page.drawText(`SPINE (${geo.spineWidthMm}mm)`, { x: spineX + 2, y: boardY + 20, font, size: 6, color: textColor, rotate: { angle: 90, type: 'degrees' } as never })
    page.drawText('FRONT BOARD', { x: frontBoardX + 10, y: boardY + boardH - 15, font: fontBold, size: 8, color: textColor })
    page.drawText('20mm TURNOVER MARGIN (Fold over greyboard)', { x: ox + 10, y: oy + 6, font, size: 7, color: textColor })
  }
}
