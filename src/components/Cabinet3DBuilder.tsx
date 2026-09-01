// 3D Cabinet Builder using Three.js
//
// Interactive 3D visualization of the speaker cabinet with driver placement
// on the baffle. Users can drag drivers to position them, see internal volume,
// and rotate/zoom the cabinet.

import { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Card, Button, NumberInput } from '@/components/common/UI'
import type { Driver } from '@/types'

export interface DriverPlacement {
  driverId: string
  label: string
  x: number // mm from center, 0 = baffle center horizontal
  y: number // mm from top of baffle
}

interface Props {
  cabinetWidth: number // external mm
  cabinetHeight: number // external mm
  cabinetDepth: number // external mm
  wallThickness: number // mm
  baffleWidth: number // mm
  baffleHeight: number // mm
  drivers: Driver[]
  placements: DriverPlacement[]
  onPlacementChange: (placements: DriverPlacement[]) => void
}

const DRIVER_COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']

export function Cabinet3DBuilder({
  cabinetWidth,
  cabinetHeight,
  cabinetDepth,
  wallThickness,
  baffleWidth,
  baffleHeight,
  drivers,
  placements,
  onPlacementChange,
}: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const cabinetGroupRef = useRef<THREE.Group | null>(null)
  const driverMeshesRef = useRef<THREE.Mesh[]>([])
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())
  const draggingRef = useRef<number | null>(null)
  const dragPlaneRef = useRef(new THREE.Plane())

  const [selectedDriver, setSelectedDriver] = useState<number | null>(null)

  // Initialize Three.js scene
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth
    const h = 400

    // Scene
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 5000)
    camera.position.set(400, 300, 500)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(window.devicePixelRatio)
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // Lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.5)
    scene.add(ambient)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(300, 400, 300)
    scene.add(dirLight)
    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.3)
    dirLight2.position.set(-300, 200, -200)
    scene.add(dirLight2)

    // Grid
    const grid = new THREE.GridHelper(1000, 20, 0x444466, 0x333355)
    grid.position.y = -cabinetHeight / 2 - 1
    scene.add(grid)

    // Cabinet group
    const group = new THREE.Group()
    scene.add(group)
    cabinetGroupRef.current = group

    // Mouse interaction: simple orbit (drag to rotate)
    let isRotating = false
    let lastX = 0
    let lastY = 0
    let azimuth = Math.atan2(camera.position.x, camera.position.z)
    let elevation = Math.atan2(camera.position.y, Math.sqrt(camera.position.x ** 2 + camera.position.z ** 2))
    let radius = camera.position.length()

    function updateCamera() {
      camera.position.x = radius * Math.cos(elevation) * Math.sin(azimuth)
      camera.position.y = radius * Math.sin(elevation)
      camera.position.z = radius * Math.cos(elevation) * Math.cos(azimuth)
      camera.lookAt(0, 0, 0)
    }

    function onMouseDown(e: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect()
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

      // Check if clicking a driver
      raycasterRef.current.setFromCamera(mouseRef.current, camera)
      const intersects = raycasterRef.current.intersectObjects(driverMeshesRef.current)
      if (intersects.length > 0) {
        const idx = driverMeshesRef.current.indexOf(intersects[0].object as THREE.Mesh)
        if (idx >= 0) {
          draggingRef.current = idx
          setSelectedDriver(idx)
          // Set drag plane: the baffle face (z = cabinetDepth/2)
          dragPlaneRef.current.setFromNormalAndCoplanarPoint(
            new THREE.Vector3(0, 0, 1),
            new THREE.Vector3(0, 0, cabinetDepth / 2)
          )
          return
        }
      }

      isRotating = true
      lastX = e.clientX
      lastY = e.clientY
    }

    function onMouseMove(e: MouseEvent) {
      if (draggingRef.current !== null) {
        const rect = renderer.domElement.getBoundingClientRect()
        mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
        mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1

        raycasterRef.current.setFromCamera(mouseRef.current, camera)
        const hitPoint = new THREE.Vector3()
        raycasterRef.current.ray.intersectPlane(dragPlaneRef.current, hitPoint)

        if (hitPoint) {
          // Convert world coords to baffle coords (mm from center, mm from top)
          const newX = Math.max(-baffleWidth / 2 + 30, Math.min(baffleWidth / 2 - 30, hitPoint.x))
          const newY = Math.max(30, Math.min(baffleHeight - 30, cabinetHeight / 2 - hitPoint.y))

          const newPlacements = [...placements]
          if (newPlacements[draggingRef.current]) {
            newPlacements[draggingRef.current] = {
              ...newPlacements[draggingRef.current]!,
              x: Math.round(newX),
              y: Math.round(newY),
            }
            onPlacementChange(newPlacements)
          }
        }
      } else if (isRotating) {
        const dx = e.clientX - lastX
        const dy = e.clientY - lastY
        azimuth -= dx * 0.005
        elevation = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, elevation + dy * 0.005))
        radius = Math.max(200, Math.min(2000, radius - dy * 0.5))
        updateCamera()
        lastX = e.clientX
        lastY = e.clientY
      }
    }

    function onMouseUp() {
      isRotating = false
      draggingRef.current = null
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      radius = Math.max(150, Math.min(3000, radius + e.deltaY * 0.3))
      updateCamera()
    }

    renderer.domElement.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false })

    // Animation loop
    let animId = 0
    function animate() {
      animId = requestAnimationFrame(animate)
      renderer.render(scene, camera)
    }
    animate()

    // Resize handler
    function handleResize() {
      if (!mount) return
      const nw = mount.clientWidth
      camera.aspect = nw / h
      camera.updateProjectionMatrix()
      renderer.setSize(nw, h)
    }
    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      cancelAnimationFrame(animId)
      renderer.domElement.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      renderer.domElement.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', handleResize)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Rebuild cabinet mesh when dimensions change
  useEffect(() => {
    const group = cabinetGroupRef.current
    const scene = sceneRef.current
    if (!group || !scene) return

    // Clear existing
    while (group.children.length > 0) {
      const child = group.children[0]!
      group.remove(child)
      if ((child as THREE.Mesh).geometry) (child as THREE.Mesh).geometry.dispose()
    }
    driverMeshesRef.current = []

    const hh = cabinetHeight / 2
    const hd = cabinetDepth / 2
    const wt = wallThickness

    // Outer cabinet (wireframe + transparent)
    const outerGeo = new THREE.BoxGeometry(cabinetWidth, cabinetHeight, cabinetDepth)
    const outerMat = new THREE.MeshPhongMaterial({
      color: 0x8b7355,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
    })
    const outerMesh = new THREE.Mesh(outerGeo, outerMat)
    group.add(outerMesh)

    // Edges (wireframe)
    const edges = new THREE.EdgesGeometry(outerGeo)
    const edgeLine = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xaaaaaa }))
    group.add(edgeLine)

    // Internal volume (slightly smaller, different color)
    const innerW = cabinetWidth - 2 * wt
    const innerH = cabinetHeight - 2 * wt
    const innerD = cabinetDepth - 2 * wt
    const innerGeo = new THREE.BoxGeometry(innerW, innerH, innerD)
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x224466,
      transparent: true,
      opacity: 0.15,
      wireframe: true,
    })
    const innerMesh = new THREE.Mesh(innerGeo, innerMat)
    group.add(innerMesh)

    // Baffle highlight (front face)
    const baffleGeo = new THREE.PlaneGeometry(baffleWidth, baffleHeight)
    const baffleMat = new THREE.MeshPhongMaterial({
      color: 0x6b5b45,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    })
    const baffleMesh = new THREE.Mesh(baffleGeo, baffleMat)
    baffleMesh.position.set(0, 0, hd + 0.5) // slightly in front of cabinet
    group.add(baffleMesh)

    // Baffle outline
    const baffleEdges = new THREE.EdgesGeometry(baffleGeo)
    const baffleOutline = new THREE.LineSegments(baffleEdges, new THREE.LineBasicMaterial({ color: 0xffcc88 }))
    baffleOutline.position.set(0, 0, hd + 1)
    group.add(baffleOutline)

    // Add drivers on baffle
    placements.forEach((placement, i) => {
      const driver = drivers.find((d) => d.id === placement.driverId)
      if (!driver) return

      const dims = driver.dimensions
      const cutoutDiameter = dims?.cutoutDiameter || dims?.overallDiameter || 100
      const radius = cutoutDiameter / 2

      // Driver body (cylinder)
      const driverGeo = new THREE.CylinderGeometry(radius, radius, 20, 32)
      const driverColor = new THREE.Color(DRIVER_COLORS[i % DRIVER_COLORS.length]!)
      const driverMat = new THREE.MeshPhongMaterial({
        color: driverColor,
        transparent: true,
        opacity: 0.7,
      })
      const driverMesh = new THREE.Mesh(driverGeo, driverMat)
      driverMesh.rotation.x = Math.PI / 2 // face forward

      // Position: x from center, y from top → world coords
      const worldX = placement.x
      const worldY = hh - placement.y // y from top → world Y
      driverMesh.position.set(worldX, worldY, hd + 10)
      driverMesh.userData.placementIndex = i
      group.add(driverMesh)
      driverMeshesRef.current.push(driverMesh)

      // Driver outline
      const outlineGeo = new THREE.RingGeometry(radius * 0.95, radius * 1.05, 32)
      const outlineMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      })
      const outline = new THREE.Mesh(outlineGeo, outlineMat)
      outline.position.set(worldX, worldY, hd + 21)
      group.add(outline)

      // Selection highlight
      if (i === selectedDriver) {
        const selGeo = new THREE.RingGeometry(radius * 1.1, radius * 1.25, 32)
        const selMat = new THREE.MeshBasicMaterial({ color: 0xffff00, side: THREE.DoubleSide })
        const sel = new THREE.Mesh(selGeo, selMat)
        sel.position.set(worldX, worldY, hd + 22)
        group.add(sel)
      }
    })
  }, [cabinetWidth, cabinetHeight, cabinetDepth, wallThickness, baffleWidth, baffleHeight, drivers, placements, selectedDriver])

  // Reset view
  const resetView = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    camera.position.set(400, 300, 500)
    camera.lookAt(0, 0, 0)
  }, [])

  // Front view
  const frontView = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    camera.position.set(0, 0, 600)
    camera.lookAt(0, 0, 0)
  }, [])

  // Top view
  const topView = useCallback(() => {
    const camera = cameraRef.current
    if (!camera) return
    camera.position.set(0, 600, 0.1)
    camera.lookAt(0, 0, 0)
  }, [])

  return (
    <Card title="3D Kabinet Builder">
      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Button onClick={resetView} variant="ghost" size="sm">↺ 3/4 view</Button>
          <Button onClick={frontView} variant="ghost" size="sm">📋 Front</Button>
          <Button onClick={topView} variant="ghost" size="sm">⬆ Top</Button>
          <span className="text-xs text-gray-500 ml-2">Træk for at rotere · Scroll for zoom · Klik+træk driver for at flytte</span>
        </div>

        {/* 3D canvas mount */}
        <div ref={mountRef} className="w-full rounded-md overflow-hidden bg-gray-900" style={{ height: 400 }} />

        {/* Driver placement controls */}
        {placements.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Driver placering på baffel</h4>
            {placements.map((p, i) => {
              const driver = drivers.find((d) => d.id === p.driverId)
              const isSelected = i === selectedDriver
              return (
                <div
                  key={i}
                  className={`flex items-center gap-2 p-2 rounded-md border ${
                    isSelected
                      ? 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: DRIVER_COLORS[i % DRIVER_COLORS.length] }}
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-400 w-24 truncate">
                    {driver?.model || p.label}
                  </span>
                  <NumberInput
                    label="X (mm)"
                    value={p.x}
                    onChange={(v) => {
                      const newPlacements = [...placements]
                      newPlacements[i] = { ...p, x: v }
                      onPlacementChange(newPlacements)
                    }}
                    className="flex-1"
                  />
                  <NumberInput
                    label="Y fra top (mm)"
                    value={p.y}
                    onChange={(v) => {
                      const newPlacements = [...placements]
                      newPlacements[i] = { ...p, y: v }
                      onPlacementChange(newPlacements)
                    }}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => setSelectedDriver(isSelected ? null : i)}
                    variant={isSelected ? 'primary' : 'ghost'}
                    size="sm"
                  >
                    {isSelected ? '✓' : 'Vælg'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}

        {/* Internal volume readout */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="text-xs text-gray-500">Ekstern V</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {((cabinetWidth * cabinetHeight * cabinetDepth) / 1e6).toFixed(1)} L
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="text-xs text-gray-500">Intern V</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {(((cabinetWidth - 2 * wallThickness) * (cabinetHeight - 2 * wallThickness) * (cabinetDepth - 2 * wallThickness)) / 1e6).toFixed(1)} L
            </div>
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-md p-2">
            <div className="text-xs text-gray-500">Baffel</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {baffleWidth}×{baffleHeight} mm
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
