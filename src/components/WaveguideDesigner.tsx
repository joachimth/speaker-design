// Oblate Spheroid (OS) Waveguide Designer
//
// The OS waveguide is a well-known horn geometry from Dr. Earl Geddes.
// It's based on an oblate spheroidal coordinate system, providing:
// - Constant directivity below the waveguide's cutoff frequency
// - Smooth transition from throat to mouth
// - Minimal diffraction at the mouth
//
// Parameters:
// - Throat diameter (1" = 25.4mm typical for tweeters)
// - Mouth diameter (determines low-frequency pattern control)
// - Depth (axial length of the waveguide)
// - Coverage angle (nominal -6dB beamwidth)
//
// The profile is generated from the OS equation:
// r(θ) = a / (1 - ε²cos²θ)^0.5
// where a = semi-major axis, ε = eccentricity

import { useRef, useMemo, useState, useCallback, useEffect } from 'react'
import * as THREE from 'three'
import { Card, Button, NumberInput } from '@/components/common/UI'

// ---------------------------------------------------------------------------
// OS waveguide math
// ---------------------------------------------------------------------------

interface OSParams {
  throatRadius: number  // mm
  mouthRadius: number   // mm
  depth: number         // mm (axial length)
  eccentricity: number  // 0-1, controls flare rate (0 = sphere, 1 = flat)
}

interface OSProfile {
  points: { x: number; z: number }[] // x = radial, z = axial (from throat at z=0)
  mouthAngle: number // degrees, half-angle at mouth
  throatAngle: number // degrees, half-angle at throat
  cutoffFreq: number // Hz, approximate pattern control cutoff
}

/**
 * Generate the OS waveguide profile.
 * The profile is a curve from throat (small radius, z=0) to mouth (large radius, z=depth).
 * Uses a parametric approach based on the oblate spheroidal equation.
 */
function computeOSProfile(params: OSParams): OSProfile {
  const { throatRadius, mouthRadius, depth, eccentricity } = params
  const numPoints = 100

  // Normalize: s goes from 0 (throat) to 1 (mouth)
  // The OS profile: r(s) = throat + (mouth - throat) * f(s)
  // where f(s) follows an oblate spheroidal curve

  const a = mouthRadius // semi-major axis
  const eps = Math.max(0.01, Math.min(0.99, eccentricity))

  const points: { x: number; z: number }[] = []
  for (let i = 0; i <= numPoints; i++) {
    const s = i / numPoints // 0 to 1

    // Parametric angle: theta goes from 0 (throat) to theta_max (mouth)
    // For OS: we map s to a pseudo-angle
    const theta = s * Math.PI / 2 * 0.95 // not full 90° to avoid singularity

    // OS radial equation: r = a * sin(theta) / sqrt(1 - eps^2 * cos^2(theta))
    // But we need to scale so r(0) = throatRadius and r(1) = mouthRadius
    const rMax = a * Math.sin(Math.PI / 2 * 0.95) / Math.sqrt(1 - eps * eps * Math.cos(Math.PI / 2 * 0.95) ** 2)
    const rNorm = a * Math.sin(theta) / Math.sqrt(1 - eps * eps * Math.cos(theta) ** 2)

    // Scale to our throat/mouth
    const x = throatRadius + (mouthRadius - throatRadius) * (rNorm / rMax)

    // Axial position: z goes from 0 to depth
    // The z mapping follows the OS axial coordinate
    // z(s) = depth * (1 - cos(theta)) / (1 - cos(theta_max))
    const thetaMax = Math.PI / 2 * 0.95
    const z = depth * (1 - Math.cos(theta)) / (1 - Math.cos(thetaMax))

    points.push({ x, z })
  }

  // Compute half-angles
  const throatDx = points[1]!.x - points[0]!.x
  const throatDz = points[1]!.z - points[0]!.z
  const throatAngle = Math.atan2(throatDx, Math.max(throatDz, 0.01)) * 180 / Math.PI

  const mouthDx = points[numPoints]!.x - points[numPoints - 1]!.x
  const mouthDz = points[numPoints]!.z - points[numPoints - 1]!.z
  const mouthAngle = Math.atan2(mouthDx, Math.max(mouthDz, 0.01)) * 180 / Math.PI

  // Pattern control cutoff: fc ≈ c / (2 * π * mouthRadius)
  // Below this frequency, the waveguide loses directivity control
  const c = 343000 // mm/s
  const cutoffFreq = c / (2 * Math.PI * mouthRadius * 2)

  return { points, mouthAngle, throatAngle, cutoffFreq }
}

/**
 * Estimate directivity index (DI) vs frequency for the OS waveguide.
 * DI ≈ 20*log10(2 * π * mouthRadius / λ) for f > fc, clamped.
 * Below fc, DI → 0 (omnidirectional).
 */
function computeDirectivity(params: OSParams, maxFreq: number = 20000): { freq: number; di: number; coverage: number }[] {
  const { mouthRadius } = params
  const c = 343000 // mm/s
  const fc = c / (2 * Math.PI * mouthRadius * 2)

  const result: { freq: number; di: number; coverage: number }[] = []
  for (let f = 100; f <= maxFreq; f *= 1.122) { // 1/6 octave steps
    const lambda = c / f
    let di = 20 * Math.log10((2 * Math.PI * mouthRadius * 2) / lambda)
    di = Math.max(0, Math.min(15, di)) // clamp 0-15 dB

    // Coverage angle (approximate): narrows with frequency
    // At fc: ~180° (omnidirectional), at 10*fc: ~20°
    let coverage = 180 / Math.max(1, (f / fc) ** 0.5)
    coverage = Math.max(20, Math.min(180, coverage))

    result.push({ freq: Math.round(f), di, coverage: Math.round(coverage) })
  }
  return result
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WaveguideDesigner() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const waveguideGroupRef = useRef<THREE.Group | null>(null)

  const [params, setParams] = useState<OSParams>({
    throatRadius: 12.7,  // 1" throat
    mouthRadius: 80,     // ~3.15" mouth
    depth: 50,           // 50mm axial
    eccentricity: 0.6,
  })

  const profile = useMemo(() => computeOSProfile(params), [params])
  const directivity = useMemo(() => computeDirectivity(params), [params])

  // Initialize Three.js scene
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth
    const h = 300

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 2000)
    camera.position.set(100, 60, 120)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(window.devicePixelRatio)
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(100, 100, 100)
    scene.add(dirLight)

    const group = new THREE.Group()
    scene.add(group)
    waveguideGroupRef.current = group

    // Simple orbit
    let isRotating = false
    let lastX = 0, lastY = 0
    let azimuth = 0.6, elevation = 0.3, radius = 180

    function updateCamera() {
      camera.position.x = radius * Math.cos(elevation) * Math.sin(azimuth)
      camera.position.y = radius * Math.sin(elevation)
      camera.position.z = radius * Math.cos(elevation) * Math.cos(azimuth)
      camera.lookAt(0, 0, 0)
    }
    updateCamera()

    function onDown(e: MouseEvent) { isRotating = true; lastX = e.clientX; lastY = e.clientY }
    function onMove(e: MouseEvent) {
      if (!isRotating) return
      azimuth -= (e.clientX - lastX) * 0.005
      elevation = Math.max(-1.4, Math.min(1.4, elevation + (e.clientY - lastY) * 0.005))
      radius = Math.max(50, Math.min(500, radius - (e.clientY - lastY) * 0.5))
      updateCamera()
      lastX = e.clientX; lastY = e.clientY
    }
    function onUp() { isRotating = false }
    function onWheel(e: WheelEvent) { e.preventDefault(); radius = Math.max(50, Math.min(500, radius + e.deltaY * 0.3)); updateCamera() }

    renderer.domElement.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    let animId = 0
    function animate() { animId = requestAnimationFrame(animate); renderer.render(scene, camera) }
    animate()

    function onResize() {
      if (!mount) return
      const nw = mount.clientWidth
      camera.aspect = nw / h
      camera.updateProjectionMatrix()
      renderer.setSize(nw, h)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      renderer.domElement.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  // Rebuild waveguide mesh when params change
  useEffect(() => {
    const group = waveguideGroupRef.current
    if (!group) return

    while (group.children.length > 0) {
      const child = group.children[0]!
      group.remove(child)
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
    }

    // Create lathe geometry from profile (rotated around Z axis)
    // Three.js LatheGeometry rotates around Y, so we need to remap:
    // profile: x=radial, z=axial → lathe: x=radial, y=axial
    const lathePoints = profile.points.map(p => new THREE.Vector2(Math.max(0.1, p.x), p.z))

    const geo = new THREE.LatheGeometry(lathePoints, 64)
    const mat = new THREE.MeshPhongMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.rotation.x = -Math.PI / 2 // align z-up
    group.add(mesh)

    // Wireframe edges
    const edges = new THREE.EdgesGeometry(geo)
    const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x88ccff }))
    edgeLine.rotation.x = -Math.PI / 2
    group.add(edgeLine)

    // Throat circle (entry)
    const throatGeo = new THREE.RingGeometry(params.throatRadius * 0.9, params.throatRadius, 64)
    const throatMat = new THREE.MeshBasicMaterial({ color: 0xff6644, side: THREE.DoubleSide })
    const throat = new THREE.Mesh(throatGeo, throatMat)
    throat.rotation.x = -Math.PI / 2
    group.add(throat)
  }, [profile, params.throatRadius])

  // Export waveguide as STL
  const handleExportSTL = useCallback(() => {
    // Build a solid of revolution from the profile using a MeshBuilder
    // We'll create a simplified STL: outer surface + throat cap + mouth cap
    const { points } = profile
    const segments = 48
    const triangles: { v1: [number, number, number]; v2: [number, number, number]; v3: [number, number, number] }[] = []

    // Helper to add a triangle
    const addTri = (a: [number, number, number], b: [number, number, number], c: [number, number, number]) => {
      triangles.push({ v1: a, v2: b, v3: c })
    }

    // Outer surface (lathe)
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i]!
      const p2 = points[i + 1]!
      for (let j = 0; j < segments; j++) {
        const a1 = (j / segments) * Math.PI * 2
        const a2 = ((j + 1) / segments) * Math.PI * 2
        const v1: [number, number, number] = [Math.cos(a1) * p1.x, Math.sin(a1) * p1.x, p1.z]
        const v2: [number, number, number] = [Math.cos(a2) * p1.x, Math.sin(a2) * p1.x, p1.z]
        const v3: [number, number, number] = [Math.cos(a2) * p2.x, Math.sin(a2) * p2.x, p2.z]
        const v4: [number, number, number] = [Math.cos(a1) * p2.x, Math.sin(a1) * p2.x, p2.z]
        addTri(v1, v2, v3)
        addTri(v1, v3, v4)
      }
    }

    // Throat cap (z=0)
    const throatCenter: [number, number, number] = [0, 0, 0]
    for (let j = 0; j < segments; j++) {
      const a1 = (j / segments) * Math.PI * 2
      const a2 = ((j + 1) / segments) * Math.PI * 2
      addTri(
        throatCenter,
        [Math.cos(a2) * points[0]!.x, Math.sin(a2) * points[0]!.x, 0],
        [Math.cos(a1) * points[0]!.x, Math.sin(a1) * points[0]!.x, 0],
      )
    }

    // Mouth cap (z=depth)
    const mouthCenter: [number, number, number] = [0, 0, params.depth]
    const mouthR = points[points.length - 1]!.x
    for (let j = 0; j < segments; j++) {
      const a1 = (j / segments) * Math.PI * 2
      const a2 = ((j + 1) / segments) * Math.PI * 2
      addTri(
        mouthCenter,
        [Math.cos(a1) * mouthR, Math.sin(a1) * mouthR, params.depth],
        [Math.cos(a2) * mouthR, Math.sin(a2) * mouthR, params.depth],
      )
    }

    // Build binary STL
    const numTri = triangles.length
    const buffer = new ArrayBuffer(84 + numTri * 50)
    const view = new DataView(buffer)
    view.setUint32(80, numTri, true)
    let offset = 84
    for (const t of triangles) {
      // Compute normal
      const [ux, uy, uz] = [t.v2[0] - t.v1[0], t.v2[1] - t.v1[1], t.v2[2] - t.v1[2]]
      const [wx, wy, wz] = [t.v3[0] - t.v1[0], t.v3[1] - t.v1[1], t.v3[2] - t.v1[2]]
      const [nx, ny, nz] = [uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx]
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      view.setFloat32(offset, nx / len, true); offset += 4
      view.setFloat32(offset, ny / len, true); offset += 4
      view.setFloat32(offset, nz / len, true); offset += 4
      for (const v of [t.v1, t.v2, t.v3]) {
        view.setFloat32(offset, v[0], true); offset += 4
        view.setFloat32(offset, v[1], true); offset += 4
        view.setFloat32(offset, v[2], true); offset += 4
      }
      view.setUint16(offset, 0, true); offset += 2
    }

    const blob = new Blob([buffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = a.download = `os-waveguide-t${params.throatRadius}mm-m${params.mouthRadius}mm.stl`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [profile, params])

  // DI plot dimensions
  const plotW = 500
  const plotH = 180
  const margin = { top: 10, right: 60, bottom: 30, left: 40 }
  const innerW = plotW - margin.left - margin.right
  const innerH = plotH - margin.top - margin.bottom

  function diX(freq: number): number {
    const x = Math.log10(Math.max(freq, 10))
    return margin.left + ((x - Math.log10(100)) / (Math.log10(20000) - Math.log10(100))) * innerW
  }
  function diY(di: number): number {
    return margin.top + (1 - di / 15) * innerH
  }

  const diPath = directivity.map((d, i) => `${i === 0 ? 'M' : 'L'}${diX(d.freq)},${diY(d.di)}`).join(' ')
  const covPath = directivity.map((d, i) => `${i === 0 ? 'M' : 'L'}${diX(d.freq)},${margin.top + (1 - d.coverage / 180) * innerH}`).join(' ')

  const decades = [100, 200, 500, 1000, 2000, 5000, 10000, 20000]

  return (
    <Card title="OS Waveguide Designer">
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Oblate Spheroid (OS) waveguide fra Dr. Earl Geddes. Giver konstant direktivitet under
          kontrol-frekvensen og glat overgang fra throat til mouth. Design profilen, se 3D preview,
          estimér direktivitet, og eksportér som STL til 3D print.
        </p>

        {/* Parameters */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <NumberInput
            label="Throat radius (mm)"
            value={params.throatRadius}
            onChange={(v) => setParams(p => ({ ...p, throatRadius: v }))}
          />
          <NumberInput
            label="Mouth radius (mm)"
            value={params.mouthRadius}
            onChange={(v) => setParams(p => ({ ...p, mouthRadius: v }))}
          />
          <NumberInput
            label="Dybde (mm)"
            value={params.depth}
            onChange={(v) => setParams(p => ({ ...p, depth: v }))}
          />
          <div>
            <label className="text-xs text-gray-500">Eccentricitet (0-1)</label>
            <input
              type="range"
              min={0.1}
              max={0.95}
              step={0.05}
              value={params.eccentricity}
              onChange={(e) => setParams(p => ({ ...p, eccentricity: parseFloat(e.target.value) }))}
              className="w-full mt-2"
            />
            <div className="text-xs text-gray-500 text-center mt-1">{params.eccentricity.toFixed(2)}</div>
          </div>
        </div>

        {/* 3D preview */}
        <div ref={mountRef} className="w-full rounded-md overflow-hidden bg-gray-900" style={{ height: 300 }} />

        {/* View controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={handleExportSTL} variant="secondary" size="sm">
            🖨️ Eksporter waveguide STL
          </Button>
          <span className="text-xs text-gray-500">Træk for at rotere · Scroll for zoom</span>
        </div>

        {/* Profile stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 text-center">
            <div className="text-xs text-gray-500">Throat vinkel</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{profile.throatAngle.toFixed(0)}°</div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 text-center">
            <div className="text-xs text-gray-500">Mouth vinkel</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{profile.mouthAngle.toFixed(0)}°</div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 text-center">
            <div className="text-xs text-gray-500">Kontrol fc</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{profile.cutoffFreq.toFixed(0)} Hz</div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2 text-center">
            <div className="text-xs text-gray-500">Mouth diameter</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">{(params.mouthRadius * 2).toFixed(0)} mm</div>
          </div>
        </div>

        {/* Directivity plot */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Direktivitet (DI) & Coverage vs frekvens</h4>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${plotW} ${plotH}`} className="w-full" style={{ minWidth: 400 }}>
              <rect x={margin.left} y={margin.top} width={innerW} height={innerH} className="fill-gray-50 stroke-gray-200 dark:fill-gray-900 dark:stroke-gray-700" />

              {decades.map(f => (
                <g key={f}>
                  <line x1={diX(f)} y1={margin.top} x2={diX(f)} y2={margin.top + innerH} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
                  <text x={diX(f)} y={margin.top + innerH + 14} textAnchor="middle" fontSize={9} className="fill-gray-500">
                    {f >= 1000 ? `${f / 1000}k` : f}
                  </text>
                </g>
              ))}

              {/* DI grid lines */}
              {[0, 5, 10, 15].map(d => (
                <g key={d}>
                  <line x1={margin.left} y1={diY(d)} x2={margin.left + innerW} y2={diY(d)} className="stroke-gray-200 dark:stroke-gray-700" strokeWidth={0.5} />
                  <text x={margin.left - 4} y={diY(d) + 3} textAnchor="end" fontSize={9} className="fill-gray-500">{d}</text>
                </g>
              ))}

              {/* DI curve */}
              <path d={diPath} fill="none" stroke="#3b82f6" strokeWidth={2} />
              {/* Coverage curve */}
              <path d={covPath} fill="none" stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2" />

              {/* Cutoff freq marker */}
              <line x1={diX(profile.cutoffFreq)} y1={margin.top} x2={diX(profile.cutoffFreq)} y2={margin.top + innerH} stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
              <text x={diX(profile.cutoffFreq)} y={margin.top - 2} textAnchor="middle" fontSize={8} className="fill-red-500">fc</text>

              {/* Legend */}
              <g transform={`translate(${margin.left + innerW + 8}, ${margin.top + 4})`}>
                <line x1={0} y1={0} x2={12} y2={0} stroke="#3b82f6" strokeWidth={2} />
                <text x={16} y={3} fontSize={9} className="fill-gray-700 dark:fill-gray-300">DI (dB)</text>
                <line x1={0} y1={14} x2={12} y2={14} stroke="#f97316" strokeWidth={1.5} strokeDasharray="4 2" />
                <text x={16} y={17} fontSize={9} className="fill-gray-700 dark:fill-gray-300">Coverage (°)</text>
              </g>

              <text x={margin.left + innerW / 2} y={plotH - 2} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300">Hz</text>
              <text x={14} y={margin.top + innerH / 2} textAnchor="middle" fontSize={10} className="fill-gray-700 dark:fill-gray-300" transform={`rotate(-90 14 ${margin.top + innerH / 2})`}>dB / °</text>
            </svg>
          </div>
        </div>

        <div className="text-xs text-gray-400">
          <p>DI stiger med frekvens indtil ~15 dB (max for denne geometri). Coverage indsnævres tilsvarende.</p>
          <p>Under fc (~{profile.cutoffFreq.toFixed(0)} Hz) mister waveguiden mønster-kontrol → omnidirectional.</p>
        </div>
      </div>
    </Card>
  )
}
