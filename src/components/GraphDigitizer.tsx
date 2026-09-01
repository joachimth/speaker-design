// Graph Digitizer component
//
// Interactive tool for extracting frequency response (SPL) or impedance curves
// from PDF datasheets or images. Supports both manual click-to-digitize and
// automatic color-mask curve detection.
//
// Workflow:
// 1. Upload PDF or image → render to canvas
// 2. Calibrate axes: click X-min, X-max, Y-min, Y-max and enter values
// 3. Manual mode: click along the curve to add points
// 4. Auto mode: pick curve color, detect pixels, extract points
// 5. Export as {freq, magnitude} array

import { useRef, useState, useCallback, useEffect } from 'react'
import { Button, Select } from '@/components/common/UI'
import type { FrequencyDataPoint, ImpedanceDataPoint } from '@/types'

type DigitizerMode = 'spl' | 'impedance'
type CalibrationStep = 'idle' | 'x-min' | 'x-max' | 'y-min' | 'y-max' | 'done'
type ExtractionMode = 'manual' | 'auto'

interface DigitizedPoint {
  px: number
  py: number
  freq: number
  magnitude: number
}

export interface GraphDigitizerResult {
  points: { freq: number; magnitude: number }[]
  mode: DigitizerMode
}

interface Props {
  mode: DigitizerMode
  onDone: (points: FrequencyDataPoint[] | ImpedanceDataPoint[]) => void
  onCancel: () => void
}

const Y_LABELS: Record<DigitizerMode, { name: string; unit: string; typicalMin: number; typicalMax: number }> = {
  spl: { name: 'SPL', unit: 'dB', typicalMin: 40, typicalMax: 100 },
  impedance: { name: 'Impedans', unit: 'Ω', typicalMin: 0, typicalMax: 50 },
}

export function GraphDigitizer({ mode, onDone, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageCanvasRef = useRef<HTMLCanvasElement>(null) // off-screen original image
  const fileRef = useRef<HTMLInputElement>(null)
  const pdfPageRef = useRef<number>(0)
  const pdfDocRef = useRef<any>(null)

  const [hasImage, setHasImage] = useState(false)
  const [calStep, setCalStep] = useState<CalibrationStep>('idle')
  const [calPoints, setCalPoints] = useState<{ px: number; py: number }[]>([])
  const [xMin, setXMin] = useState(20)
  const [xMax, setXMax] = useState(20000)
  const [yMin, setYMin] = useState(Y_LABELS[mode].typicalMin)
  const [yMax, setYMax] = useState(Y_LABELS[mode].typicalMax)
  const [extractionMode, setExtractionMode] = useState<ExtractionMode>('manual')
  const [digitizedPoints, setDigitizedPoints] = useState<DigitizedPoint[]>([])
  const [numPages, setNumPages] = useState(1)
  const [currentPage, setCurrentPage] = useState(1)
  const [autoColor, setAutoColor] = useState<{ r: number; g: number; b: number } | null>(null)
  const [autoThreshold, setAutoThreshold] = useState(60)
  const [status, setStatus] = useState('Upload en PDF eller billede med en frekvensgraf')

  const yLabel = Y_LABELS[mode]

  // Load image to canvas
  const loadImageToCanvas = useCallback((img: HTMLImageElement | HTMLCanvasElement, w: number, h: number) => {
    const canvas = canvasRef.current
    const offCanvas = imageCanvasRef.current
    if (!canvas || !offCanvas) return

    // Scale to fit max 900px wide
    const scale = Math.min(1, 900 / w)
    const cw = Math.round(w * scale)
    const ch = Math.round(h * scale)

    canvas.width = cw
    canvas.height = ch
    offCanvas.width = w
    offCanvas.height = h

    const ctx = canvas.getContext('2d')!
    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true })!

    if (img instanceof HTMLImageElement) {
      ctx.drawImage(img, 0, 0, cw, ch)
      offCtx.drawImage(img, 0, 0, w, h)
    } else {
      ctx.drawImage(img, 0, 0, cw, ch)
      offCtx.drawImage(img, 0, 0, w, h)
    }

    setHasImage(true)
    setCalStep('x-min')
    setCalPoints([])
    setDigitizedPoints([])
    setStatus('Klik på X-aksens minimum (laveste frekvens)')
  }, [])

  // Handle file upload
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setStatus('Indlæser...')

    try {
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const buf = await file.arrayBuffer()
        const pdfjs = await import('pdfjs-dist')
        const workerUrl = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        const doc = await pdfjs.getDocument({ data: buf }).promise
        pdfDocRef.current = doc
        setNumPages(doc.numPages)
        setCurrentPage(1)
        pdfPageRef.current = 1
        await renderPdfPage(1)
      } else {
        // Image file
        const url = URL.createObjectURL(file)
        const img = new Image()
        img.onload = () => {
          loadImageToCanvas(img, img.naturalWidth, img.naturalHeight)
          URL.revokeObjectURL(url)
        }
        img.src = url
      }
    } catch (err: any) {
      setStatus(`Fejl: ${err.message}`)
    }

    if (fileRef.current) fileRef.current.value = ''
  }

  async function renderPdfPage(pageNum: number) {
    const doc = pdfDocRef.current
    if (!doc) return
    setStatus(`Renderer side ${pageNum}...`)
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    loadImageToCanvas(canvas, viewport.width, viewport.height)
  }

  async function changePage(delta: number) {
    const newPage = currentPage + delta
    if (newPage < 1 || newPage > numPages) return
    setCurrentPage(newPage)
    pdfPageRef.current = newPage
    await renderPdfPage(newPage)
  }

  // Canvas click handler
  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current
    if (!canvas || !hasImage) return

    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const px = (e.clientX - rect.left) * scaleX
    const py = (e.clientY - rect.top) * scaleY

    if (calStep !== 'done') {
      // Calibration phase
      const newCalPoints = [...calPoints, { px, py }]
      setCalPoints(newCalPoints)

      if (calStep === 'x-min') {
        setCalStep('x-max')
        setStatus('Klik på X-aksens maksimum (højeste frekvens)')
      } else if (calStep === 'x-max') {
        setCalStep('y-min')
        setStatus(`Klik på Y-aksens minimum (laveste ${yLabel.name})`)
      } else if (calStep === 'y-min') {
        setCalStep('y-max')
        setStatus(`Klik på Y-aksens maksimum (højeste ${yLabel.name})`)
      } else if (calStep === 'y-max') {
        setCalStep('done')
        setStatus(extractionMode === 'manual'
          ? 'Klik langs kurven for at tilføje punkter. Brug log-skala for X.'
          : 'Vælg kurvens farve ved at klikke på den, ellerjustér tærskel.')
      }
      drawOverlay()
    } else if (extractionMode === 'manual') {
      // Add digitized point
      const point = pxToData(px, py)
      if (point) {
        setDigitizedPoints((prev) => [...prev, point].sort((a, b) => a.freq - b.freq))
        setStatus(`${digitizedPoints.length + 1} punkter. Klik mere eller eksporter.`)
      }
    } else if (extractionMode === 'auto' && !autoColor) {
      // Pick color from clicked pixel
      const offCanvas = imageCanvasRef.current
      if (!offCanvas) return
      const offCtx = offCanvas.getContext('2d', { willReadFrequently: true })!
      const scaleX = offCanvas.width / canvas.width
      const scaleY = offCanvas.height / canvas.height
      const data = offCtx.getImageData(Math.round(px * scaleX), Math.round(py * scaleY), 1, 1).data
      setAutoColor({ r: data[0]!, g: data[1]!, b: data[2]! })
      setStatus('Farve valgt. Klik "Detekter kurve" eller justér tærskel.')
    }
  }

  // Convert pixel coords to data coords
  function pxToData(px: number, py: number): DigitizedPoint | null {
    if (calPoints.length < 4 || calStep !== 'done') return null
    const [xminPx, xmaxPx, yminPx, ymaxPx] = calPoints

    // Log scale for X (frequency)
    const logMin = Math.log10(xMin)
    const logMax = Math.log10(xMax)
    const xFrac = (px - xminPx!.px) / (xmaxPx!.px - xminPx!.px)
    const freq = Math.pow(10, logMin + xFrac * (logMax - logMin))

    // Linear scale for Y (magnitude)
    const yFrac = (py - yminPx!.py) / (ymaxPx!.py - yminPx!.py)
    const magnitude = yMin + (1 - yFrac) * (yMax - yMin) // invert Y (canvas top = high value)

    return { px, py, freq, magnitude }
  }

  // Draw overlay (calibration markers + digitized points)
  function drawOverlay() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    // Redraw original image
    const offCanvas = imageCanvasRef.current
    if (offCanvas) {
      ctx.drawImage(offCanvas, 0, 0, canvas.width, canvas.height)
    }

    // Draw calibration markers
    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b']
    const labels = ['X-min', 'X-max', 'Y-min', 'Y-max']
    calPoints.forEach((p, i) => {
      ctx.strokeStyle = colors[i]!
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(p.px, p.py, 8, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = colors[i]!
      ctx.font = '10px sans-serif'
      ctx.fillText(labels[i], p.px + 10, p.py - 5)
    })

    // Draw digitized points
    if (digitizedPoints.length > 1) {
      ctx.strokeStyle = mode === 'spl' ? '#f97316' : '#8b5cf6'
      ctx.lineWidth = 2
      ctx.beginPath()
      digitizedPoints.forEach((p, i) => {
        if (i === 0) ctx.moveTo(p.px, p.py)
        else ctx.lineTo(p.px, p.py)
      })
      ctx.stroke()
    }
    digitizedPoints.forEach((p) => {
      ctx.fillStyle = mode === 'spl' ? '#f97316' : '#8b5cf6'
      ctx.beginPath()
      ctx.arc(p.px, p.py, 3, 0, Math.PI * 2)
      ctx.fill()
    })

    // Draw auto-detected points
    if (autoColor) {
      // redraw will happen via auto-detect
    }
  }

  // Redraw overlay when state changes
  useEffect(() => {
    if (hasImage) drawOverlay()
  }, [calPoints, digitizedPoints, hasImage])

  // Auto-detect curve via color masking
  function autoDetect() {
    if (!autoColor) {
      setStatus('Klik på kurven for at vælge dens farve først.')
      return
    }

    const canvas = canvasRef.current
    const offCanvas = imageCanvasRef.current
    if (!canvas || !offCanvas) return

    const offCtx = offCanvas.getContext('2d', { willReadFrequently: true })!
    const w = offCanvas.width
    const h = offCanvas.height
    const imageData = offCtx.getImageData(0, 0, w, h)
    const data = imageData.data

    const { r: tr, g: tg, b: tb } = autoColor
    const threshold = autoThreshold

    // For each X pixel column, find the best matching Y pixel
    const scaleX = canvas.width / w
    const scaleY = canvas.height / h
    const points: DigitizedPoint[] = []

    const step = Math.max(1, Math.floor(w / 400)) // sample ~400 columns

    for (let x = 0; x < w; x += step) {
      let bestY = -1
      let bestDist = Infinity

      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4
        const r = data[idx]!
        const g = data[idx + 1]!
        const b = data[idx + 2]!
        const dist = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2)
        if (dist < threshold && dist < bestDist) {
          bestDist = dist
          bestY = y
        }
      }

      if (bestY >= 0) {
        const px = x * scaleX
        const py = bestY * scaleY
        const point = pxToData(px, py)
        if (point && point.freq > 0 && isFinite(point.magnitude)) {
          points.push(point)
        }
      }
    }

    // Sort and deduplicate by frequency
    points.sort((a, b) => a.freq - b.freq)
    const deduped: DigitizedPoint[] = []
    let lastFreq = 0
    for (const p of points) {
      if (p.freq - lastFreq > 0.5) {
        deduped.push(p)
        lastFreq = p.freq
      }
    }

    setDigitizedPoints(deduped)
    setStatus(`Auto-detekteret ${deduped.length} punkter. Justér tærskel eller farve hvis nødvendigt.`)
  }

  // Clear digitized points
  function clearPoints() {
    setDigitizedPoints([])
    setStatus('Punkter ryddet.')
  }

  // Undo last point (manual mode)
  function undoLastPoint() {
    setDigitizedPoints((prev) => prev.slice(0, -1))
  }

  // Reset calibration
  function resetCalibration() {
    setCalStep('x-min')
    setCalPoints([])
    setDigitizedPoints([])
    setStatus('Klik på X-aksens minimum (laveste frekvens)')
  }

  // Export points
  function handleExport() {
    if (digitizedPoints.length < 2) {
      setStatus('Brug for mindst 2 punkter.')
      return
    }

    const sorted = [...digitizedPoints].sort((a, b) => a.freq - b.freq)
    const points = sorted.map((p) => ({ freq: Math.round(p.freq * 10) / 10, magnitude: Math.round(p.magnitude * 100) / 100 }))

    if (mode === 'spl') {
      onDone(points as FrequencyDataPoint[])
    } else {
      onDone(points as ImpedanceDataPoint[])
    }
  }

  // Swap Y min/max if user entered them reversed
  useEffect(() => {
    if (yMin > yMax) {
      const tmp = yMin
      setYMin(yMax)
      setYMax(tmp)
    }
  }, [yMin, yMax])

  return (
    <div className="fixed inset-0 z-[90] bg-black/70 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-y-auto p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            📐 Graf Digitizer — {yLabel.name} ({yLabel.unit})
          </h2>
          <Button onClick={onCancel} variant="ghost" size="sm">✕ Luk</Button>
        </div>

        {/* File upload */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*,.pdf,.png,.jpg,.jpeg"
            onChange={handleFile}
            className="hidden"
          />
          <Button onClick={() => fileRef.current?.click()} variant="primary" size="sm">
            📎 Upload PDF / billede
          </Button>
          {numPages > 1 && (
            <div className="flex items-center gap-1">
              <Button onClick={() => changePage(-1)} variant="ghost" size="sm" disabled={currentPage <= 1}>‹</Button>
              <span className="text-xs text-gray-500">Side {currentPage}/{numPages}</span>
              <Button onClick={() => changePage(1)} variant="ghost" size="sm" disabled={currentPage >= numPages}>›</Button>
            </div>
          )}
        </div>

        {/* Canvas */}
        {hasImage && (
          <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-auto bg-gray-50 dark:bg-gray-900">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="cursor-crosshair max-w-full"
              style={{ display: 'block' }}
            />
            <canvas ref={imageCanvasRef} className="hidden" />
          </div>
        )}

        {/* Status */}
        <div className={`text-sm px-3 py-2 rounded-md ${digitizedPoints.length > 0 ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
          {status}
        </div>

        {/* Calibration controls */}
        {hasImage && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="text-xs text-gray-500">X min (Hz)</label>
              <input
                type="number"
                value={xMin}
                onChange={(e) => setXMin(parseFloat(e.target.value) || 1)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">X max (Hz)</label>
              <input
                type="number"
                value={xMax}
                onChange={(e) => setXMax(parseFloat(e.target.value) || 1)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">{yLabel.name} min ({yLabel.unit})</label>
              <input
                type="number"
                value={yMin}
                onChange={(e) => setYMin(parseFloat(e.target.value) || 0)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">{yLabel.name} max ({yLabel.unit})</label>
              <input
                type="number"
                value={yMax}
                onChange={(e) => setYMax(parseFloat(e.target.value) || 1)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        )}

        {/* Extraction mode + actions */}
        {calStep === 'done' && (
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={extractionMode}
              onChange={(v) => {
                setExtractionMode(v as ExtractionMode)
                setAutoColor(null)
                setStatus(v === 'manual' ? 'Klik langs kurven for at tilføje punkter.' : 'Klik på kurven for at vælge dens farve.')
              }}
              options={[
                { value: 'manual', label: '✋ Manuel (klik)' },
                { value: 'auto', label: '🤖 Auto (farve-detektion)' },
              ]}
              className="w-auto"
            />

            {extractionMode === 'manual' ? (
              <>
                <Button onClick={undoLastPoint} variant="ghost" size="sm" disabled={digitizedPoints.length === 0}>
                  ↩ Fortryd
                </Button>
                <Button onClick={clearPoints} variant="ghost" size="sm" disabled={digitizedPoints.length === 0}>
                  🗑 Ryd punkter
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Tærskel:</label>
                  <input
                    type="range"
                    min={20}
                    max={150}
                    value={autoThreshold}
                    onChange={(e) => setAutoThreshold(parseInt(e.target.value))}
                    className="w-24"
                  />
                  <span className="text-xs text-gray-500 w-8">{autoThreshold}</span>
                </div>
                {autoColor && (
                  <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded border border-gray-300" style={{ background: `rgb(${autoColor.r},${autoColor.g},${autoColor.b})` }} />
                    <Button onClick={() => { setAutoColor(null); setStatus('Klik på kurven for at vælge farve.') }} variant="ghost" size="sm">
                      Ny farve
                    </Button>
                  </div>
                )}
                <Button onClick={autoDetect} variant="secondary" size="sm" disabled={!autoColor}>
                  🔍 Detekter kurve
                </Button>
              </>
            )}

            <Button onClick={resetCalibration} variant="ghost" size="sm">
              ⟲ Rekallibrer
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500">{digitizedPoints.length} punkter</span>
              <Button onClick={handleExport} variant="primary" size="sm" disabled={digitizedPoints.length < 2}>
                ✓ Gem {digitizedPoints.length} punkter
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-400 space-y-1">
          <p><b>Manual:</b> Klik 4 hjørner for at kalibrere akserne (X-min, X-max, Y-min, Y-max), indtast værdierne, klik langs kurven.</p>
          <p><b>Auto:</b> Efter kalibrering, skift til auto mode, klik på kurven for at vælge farve, justér tærskel, klik "Detekter kurve".</p>
        </div>
      </div>
    </div>
  )
}
