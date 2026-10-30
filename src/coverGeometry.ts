export type CoverType = 'paperback' | 'hardcover'
export type LeafSize = 'A5' | 'HalfLetter'

export interface CoverSpec {
  coverType: CoverType
  leafWidthMm: number
  leafHeightMm: number
  pageCount: number
  paperCaliperMm?: number // default 0.09mm per leaf
  spineOverrideMm?: number
  turnoverMm?: number // hardcover wrap margin, default 20mm
}

export interface CoverGeometry {
  coverType: CoverType
  leafWidthMm: number
  leafHeightMm: number
  spineWidthMm: number
  // Components
  frontWidthMm: number
  backWidthMm: number
  coverHeightMm: number
  turnoverMm: number
  hingeGapMm: number
  bleedMm: number
  // Total flat wrap dimensions
  totalWidthMm: number
  totalHeightMm: number
  // Best single-sheet paper fit
  bestPaperFit: { name: string; widthMm: number; heightMm: number } | null
  fitsOnA4: boolean
  fitsOnLetter: boolean
}

export const STANDARD_PAPERS = [
  { name: 'Letter', widthMm: 279.4, heightMm: 215.9 },
  { name: 'A4', widthMm: 297.0, heightMm: 210.0 },
  { name: 'Legal', widthMm: 355.6, heightMm: 215.9 },
  { name: 'A3', widthMm: 420.0, heightMm: 297.0 },
  { name: 'Tabloid (11x17)', widthMm: 431.8, heightMm: 279.4 },
]

export const LEAF_PRESETS: Record<LeafSize, { widthMm: number; heightMm: number }> = {
  A5: { widthMm: 148.5, heightMm: 210.0 },
  HalfLetter: { widthMm: 139.7, heightMm: 215.9 },
}

export function calculateSpineWidth(pageCount: number, caliperMm = 0.09): number {
  const leaves = Math.ceil(pageCount / 2)
  return Math.max(3, Math.round(leaves * caliperMm * 10) / 10)
}

export function computeCoverGeometry(spec: CoverSpec): CoverGeometry {
  const spine = spec.spineOverrideMm ?? calculateSpineWidth(spec.pageCount, spec.paperCaliperMm ?? 0.09)

  if (spec.coverType === 'paperback') {
    const bleed = 3.0
    const frontWidth = spec.leafWidthMm
    const backWidth = spec.leafWidthMm
    const height = spec.leafHeightMm + 2 * bleed
    const width = backWidth + spine + frontWidth + 2 * bleed

    const bestFit = STANDARD_PAPERS.find(p => p.widthMm >= width && p.heightMm >= height) ?? null

    return {
      coverType: 'paperback',
      leafWidthMm: spec.leafWidthMm,
      leafHeightMm: spec.leafHeightMm,
      spineWidthMm: spine,
      frontWidthMm: frontWidth,
      backWidthMm: backWidth,
      coverHeightMm: height,
      turnoverMm: 0,
      hingeGapMm: 5.0, // opening crease offset
      bleedMm: bleed,
      totalWidthMm: Math.round(width * 10) / 10,
      totalHeightMm: Math.round(height * 10) / 10,
      bestPaperFit: bestFit,
      fitsOnA4: 297.0 >= width && 210.0 >= height,
      fitsOnLetter: 279.4 >= width && 215.9 >= height,
    }
  }

  // Hardcover
  const square = 3.0 // overhang beyond text block
  const boardWidth = spec.leafWidthMm + square
  const boardHeight = spec.leafHeightMm + 2 * square
  const hinge = 8.0 // joint groove
  const turnover = spec.turnoverMm ?? 20.0 // turnover margin to wrap greyboard

  const totalWidth = 2 * turnover + 2 * boardWidth + 2 * hinge + spine
  const totalHeight = boardHeight + 2 * turnover

  const bestFit = STANDARD_PAPERS.find(p => p.widthMm >= totalWidth && p.heightMm >= totalHeight) ?? null

  return {
    coverType: 'hardcover',
    leafWidthMm: spec.leafWidthMm,
    leafHeightMm: spec.leafHeightMm,
    spineWidthMm: spine,
    frontWidthMm: boardWidth,
    backWidthMm: boardWidth,
    coverHeightMm: boardHeight,
    turnoverMm: turnover,
    hingeGapMm: hinge,
    bleedMm: 0,
    totalWidthMm: Math.round(totalWidth * 10) / 10,
    totalHeightMm: Math.round(totalHeight * 10) / 10,
    bestPaperFit: bestFit,
    fitsOnA4: 297.0 >= totalWidth && 210.0 >= totalHeight,
    fitsOnLetter: 279.4 >= totalWidth && 215.9 >= totalHeight,
  }
}
