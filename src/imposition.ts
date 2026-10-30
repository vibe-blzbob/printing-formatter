/** A printed side of a sheet: [left, right] source page index, null = blank. */
export type Side = [number | null, number | null]

export interface Sheet {
  signature: number // 1-based
  sheet: number // 1-based, within its signature
  front: Side
  back: Side
}

/**
 * 2-up saddle-stitch imposition. Pages are padded to a multiple of 4; the last
 * signature may have fewer sheets than the rest (fewer wasted blanks).
 */
export function impose(pageCount: number, sheetsPerSignature: number): Sheet[] {
  if (!Number.isInteger(pageCount) || pageCount < 1) throw new Error('pageCount must be a positive integer')
  if (!Number.isInteger(sheetsPerSignature) || sheetsPerSignature < 1) throw new Error('sheetsPerSignature must be a positive integer')

  const padded = Math.ceil(pageCount / 4) * 4
  const page = (i: number) => (i < pageCount ? i : null)
  const sheets: Sheet[] = []

  for (let start = 0, sig = 1; start < padded; start += sheetsPerSignature * 4, sig++) {
    const p = Math.min(sheetsPerSignature * 4, padded - start) // pages in this signature
    for (let i = 0; i < p / 4; i++) {
      // 1-based within signature: front [p-2i, 2i+1], back [2i+2, p-2i-1]
      sheets.push({
        signature: sig,
        sheet: i + 1,
        front: [page(start + p - 2 * i - 1), page(start + 2 * i)],
        back: [page(start + 2 * i + 1), page(start + p - 2 * i - 2)],
      })
    }
  }
  return sheets
}

export const blankCount = (pageCount: number) => Math.ceil(pageCount / 4) * 4 - pageCount
