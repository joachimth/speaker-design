// PNG export utility for SVG-based plots
//
// Converts an SVG element to a PNG image and triggers download.
// Works by serializing the SVG, drawing it onto a canvas, and exporting.

/**
 * Export an SVG element to a PNG file.
 *
 * @param svgElement  The SVG DOM element to export
 * @param filename    Output filename (without extension)
 * @param scale       Scale factor for resolution (2 = 2x resolution)
 */
export async function exportSvgToPng(
  svgElement: SVGSVGElement,
  filename: string,
  scale: number = 2,
): Promise<void> {
  const svgClone = svgElement.cloneNode(true) as SVGSVGElement

  // Get dimensions
  const bbox = svgElement.getBoundingClientRect()
  const width = bbox.width || svgElement.viewBox.baseVal.width || 800
  const height = bbox.height || svgElement.viewBox.baseVal.height || 400

  // Set explicit dimensions on clone
  svgClone.setAttribute('width', String(width))
  svgClone.setAttribute('height', String(height))
  svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Add background color for dark mode compatibility
  const isDark = document.documentElement.classList.contains('dark')
  const bgColor = isDark ? '#111827' : '#f9fafb'

  // Create a rect element for the background
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
  bgRect.setAttribute('width', '100%')
  bgRect.setAttribute('height', '100%')
  bgRect.setAttribute('fill', bgColor)
  svgClone.insertBefore(bgRect, svgClone.firstChild)

  // Serialize SVG
  const svgData = new XMLSerializer().serializeToString(svgClone)
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
  const svgUrl = URL.createObjectURL(svgBlob)

  // Create canvas and draw
  const canvas = document.createElement('canvas')
  canvas.width = width * scale
  canvas.height = height * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(svgUrl)
    return
  }

  ctx.scale(scale, scale)

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Failed to load SVG'))
    img.src = svgUrl
  })

  ctx.drawImage(img, 0, 0, width, height)
  URL.revokeObjectURL(svgUrl)

  // Export to PNG
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${filename}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

/**
 * Find the first SVG element within a container element.
 */
export function findFirstSvg(container: HTMLElement): SVGSVGElement | null {
  return container.querySelector('svg')
}

/**
 * Export the first SVG plot within a container to PNG.
 *
 * @param container   The container element (e.g. a Card div)
 * @param filename    Output filename
 * @param scale       Resolution scale
 */
export async function exportPlotToPng(
  container: HTMLElement,
  filename: string,
  scale: number = 2,
): Promise<void> {
  const svg = findFirstSvg(container)
  if (!svg) return
  await exportSvgToPng(svg, filename, scale)
}
