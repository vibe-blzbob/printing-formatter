export interface RawImageBuffer {
  width: number
  height: number
  data: Uint8ClampedArray
}

/**
 * 3x3 Laplacian edge-sharpening convolution filter.
 * Brings out fine line details, typography, and textures for physical print ink reproduction.
 */
export function applySharpen(buf: RawImageBuffer, strength = 0.35): RawImageBuffer {
  const { width, height, data } = buf
  const output = new Uint8ClampedArray(data)

  const cWeight = 1 + 4 * strength
  const aWeight = -strength

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        const center = data[idx + c]
        const top = data[((y - 1) * width + x) * 4 + c]
        const bottom = data[((y + 1) * width + x) * 4 + c]
        const left = data[(y * width + (x - 1)) * 4 + c]
        const right = data[(y * width + (x + 1)) * 4 + c]
        const val = center * cWeight + (top + bottom + left + right) * aWeight
        output[idx + c] = Math.min(255, Math.max(0, val))
      }
    }
  }

  return { width, height, data: output }
}

/**
 * Enhances an image file for print:
 * 1. Adjusts contrast (+8%) and vibrancy (+5%) to counter paper ink absorption
 * 2. Applies 3x3 unsharp convolution sharpening to crispen edges
 */
export async function enhanceImageForPrint(file: File): Promise<{ dataUrl: string; bytes: Uint8Array }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return reject(new Error('Canvas 2D context unavailable'))

        // Subtle pre-press contrast and saturation adjustment
        ctx.filter = 'contrast(1.08) saturate(1.05)'
        ctx.drawImage(img, 0, 0)
        ctx.filter = 'none'

        // Apply edge sharpening
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const sharpened = applySharpen(imgData, 0.35)
        imgData.data.set(sharpened.data)
        ctx.putImageData(imgData, 0, 0)

        canvas.toBlob(
          async blob => {
            if (!blob) return reject(new Error('Blob encoding failed'))
            const bytes = new Uint8Array(await blob.arrayBuffer())
            const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
            resolve({ dataUrl, bytes })
          },
          'image/jpeg',
          0.92,
        )
      } catch (err) {
        reject(err)
      }
    }

    img.onerror = () => reject(new Error('Failed to load image for enhancement'))
    img.src = url
  })
}
