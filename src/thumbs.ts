import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

/** Yields one JPEG data URL per page, in order. Breaking out of the loop frees the document. */
// ponytail: renders every page sequentially; switch to IntersectionObserver-driven rendering if 1000+ page books feel slow
export async function* renderThumbs(data: ArrayBuffer, width = 160) {
  const task = pdfjs.getDocument({ data })
  const doc = await task.promise
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width })
      const canvas = document.createElement('canvas')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvas, viewport }).promise
      page.cleanup()
      yield canvas.toDataURL('image/jpeg', 0.7)
    }
  } finally {
    await task.destroy()
  }
}
