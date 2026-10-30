import { expect, test } from 'vitest'
import { applySharpen } from './imageEnhance'

test('applySharpen sharpens edge contrast on pixel data', () => {
  // 3x3 image buffer with a dark line next to bright pixels
  const width = 3
  const height = 3
  const data = new Uint8ClampedArray(width * height * 4)

  // Fill with flat grey (100) except center pixel is brighter (150)
  for (let i = 0; i < width * height * 4; i += 4) {
    data[i] = 100
    data[i + 1] = 100
    data[i + 2] = 100
    data[i + 3] = 255
  }

  // Center pixel (1, 1) -> index 4 in 0..8
  const centerIdx = (1 * width + 1) * 4
  data[centerIdx] = 150
  data[centerIdx + 1] = 150
  data[centerIdx + 2] = 150

  const result = applySharpen({ width, height, data }, 0.4)

  // With a positive center contrast, the center pixel should become sharper (higher than 150)
  expect(result.data[centerIdx]).toBeGreaterThan(150)
})

test('applySharpen preserves boundary bounds between 0 and 255', () => {
  const width = 3
  const height = 3
  const data = new Uint8ClampedArray(width * height * 4).fill(250)
  const result = applySharpen({ width, height, data }, 1.0)

  for (let i = 0; i < result.data.length; i++) {
    expect(result.data[i]).toBeGreaterThanOrEqual(0)
    expect(result.data[i]).toBeLessThanOrEqual(255)
  }
})
