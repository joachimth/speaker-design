// STL mesh export utility
//
// Generates binary STL files from simple geometric primitives for 3D printing.
// Supports: box (cabinet shell), cylinder cutouts (driver holes), baffle panel.

export interface Vec3 {
  x: number
  y: number
  z: number
}

interface Triangle {
  v1: Vec3
  v2: Vec3
  v3: Vec3
  normal: Vec3
}

// ---------------------------------------------------------------------------
// Mesh builder: collects triangles, outputs binary STL
// ---------------------------------------------------------------------------

class MeshBuilder {
  private triangles: Triangle[] = []

  addTriangle(v1: Vec3, v2: Vec3, v3: Vec3): void {
    const normal = computeNormal(v1, v2, v3)
    this.triangles.push({ v1, v2, v3, normal })
  }

  addQuad(v1: Vec3, v2: Vec3, v3: Vec3, v4: Vec3): void {
    this.addTriangle(v1, v2, v3)
    this.addTriangle(v1, v3, v4)
  }

  /** Add a box (rectangular cuboid) defined by min/max corners. */
  addBox(min: Vec3, max: Vec3): void {
    const [x0, y0, z0] = [min.x, min.y, min.z]
    const [x1, y1, z1] = [max.x, max.y, max.z]

    // Bottom (y-)
    this.addQuad({ x: x0, y: y0, z: z0 }, { x: x0, y: y0, z: z1 }, { x: x1, y: y0, z: z1 }, { x: x1, y: y0, z: z0 })
    // Top (y+)
    this.addQuad({ x: x0, y: y1, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x1, y: y1, z: z1 }, { x: x0, y: y1, z: z1 })
    // Front (z-)
    this.addQuad({ x: x0, y: y0, z: z0 }, { x: x1, y: y0, z: z0 }, { x: x1, y: y1, z: z0 }, { x: x0, y: y1, z: z0 })
    // Back (z+)
    this.addQuad({ x: x0, y: y0, z: z1 }, { x: x0, y: y1, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y0, z: z1 })
    // Left (x-)
    this.addQuad({ x: x0, y: y0, z: z0 }, { x: x0, y: y1, z: z0 }, { x: x0, y: y1, z: z1 }, { x: x0, y: y0, z: z1 })
    // Right (x+)
    this.addQuad({ x: x1, y: y0, z: z0 }, { x: x1, y: y0, z: z1 }, { x: x1, y: y1, z: z1 }, { x: x1, y: y1, z: z0 })
  }

  /**
   * Add a hollow box (cabinet shell): outer box minus inner cavity.
   * This creates 6 wall panels as separate quads.
   */
  addHollowBox(outerMin: Vec3, outerMax: Vec3, wallThickness: number): void {
    const wt = wallThickness
    // Inner cavity
    const innerMin: Vec3 = { x: outerMin.x + wt, y: outerMin.y + wt, z: outerMin.z + wt }
    const innerMax: Vec3 = { x: outerMax.x - wt, y: outerMax.y - wt, z: outerMax.z - wt }

    const [ox0, oy0, oz0] = [outerMin.x, outerMin.y, outerMin.z]
    const [ox1, oy1, oz1] = [outerMax.x, outerMax.y, outerMax.z]
    const [ix0, iy0, iz0] = [innerMin.x, innerMin.y, innerMin.z]
    const [ix1, iy1, iz1] = [innerMax.x, innerMax.y, innerMax.z]

    // Bottom wall
    this.addQuad({ x: ox0, y: oy0, z: oz0 }, { x: ox0, y: oy0, z: oz1 }, { x: ox1, y: oy0, z: oz1 }, { x: ox1, y: oy0, z: oz0 })
    this.addQuad({ x: ox0, y: oy0, z: oz0 }, { x: ox1, y: oy0, z: oz0 }, { x: ix1, y: iy0, z: iz0 }, { x: ix0, y: iy0, z: iz0 })
    this.addQuad({ x: ix0, y: iy0, z: iz0 }, { x: ix1, y: iy0, z: iz0 }, { x: ix1, y: iy0, z: iz1 }, { x: ix0, y: iy0, z: iz1 })
    this.addQuad({ x: ix0, y: iy0, z: iz1 }, { x: ix1, y: iy0, z: iz1 }, { x: ox1, y: oy0, z: oz1 }, { x: ox0, y: oy0, z: oz1 })

    // Top wall
    this.addQuad({ x: ox0, y: oy1, z: oz0 }, { x: ox1, y: oy1, z: oz0 }, { x: ox1, y: oy1, z: oz1 }, { x: ox0, y: oy1, z: oz1 })
    this.addQuad({ x: ox0, y: oy1, z: oz0 }, { x: ix0, y: iy1, z: iz0 }, { x: ix1, y: iy1, z: iz0 }, { x: ox1, y: oy1, z: oz0 })
    this.addQuad({ x: ix0, y: iy1, z: iz0 }, { x: ix0, y: iy1, z: iz1 }, { x: ix1, y: iy1, z: iz1 }, { x: ix1, y: iy1, z: iz0 })
    this.addQuad({ x: ix0, y: iy1, z: iz1 }, { x: ox0, y: oy1, z: oz1 }, { x: ox1, y: oy1, z: oz1 }, { x: ix1, y: iy1, z: iz1 })

    // Left wall
    this.addQuad({ x: ox0, y: oy0, z: oz0 }, { x: ox0, y: oy0, z: oz1 }, { x: ox0, y: oy1, z: oz1 }, { x: ox0, y: oy1, z: oz0 })
    this.addQuad({ x: ox0, y: oy0, z: oz0 }, { x: ix0, y: iy0, z: iz0 }, { x: ix0, y: iy1, z: iz0 }, { x: ox0, y: oy1, z: oz0 })
    this.addQuad({ x: ix0, y: iy0, z: iz0 }, { x: ix0, y: iy0, z: iz1 }, { x: ix0, y: iy1, z: iz1 }, { x: ix0, y: iy1, z: iz0 })
    this.addQuad({ x: ix0, y: iy0, z: iz1 }, { x: ox0, y: oy0, z: oz1 }, { x: ox0, y: oy1, z: oz1 }, { x: ix0, y: iy1, z: iz1 })

    // Right wall
    this.addQuad({ x: ox1, y: oy0, z: oz0 }, { x: ox1, y: oy1, z: oz0 }, { x: ox1, y: oy1, z: oz1 }, { x: ox1, y: oy0, z: oz1 })
    this.addQuad({ x: ox1, y: oy0, z: oz0 }, { x: ox1, y: oy1, z: oz0 }, { x: ix1, y: iy1, z: iz0 }, { x: ix1, y: iy0, z: iz0 })
    this.addQuad({ x: ix1, y: iy0, z: iz0 }, { x: ix1, y: iy1, z: iz0 }, { x: ix1, y: iy1, z: iz1 }, { x: ix1, y: iy0, z: iz1 })
    this.addQuad({ x: ix1, y: iy0, z: iz1 }, { x: ix1, y: iy1, z: iz1 }, { x: ox1, y: oy1, z: oz1 }, { x: ox1, y: oy0, z: oz1 })

    // Back wall (z+)
    this.addQuad({ x: ox0, y: oy0, z: oz1 }, { x: ox0, y: oy1, z: oz1 }, { x: ox1, y: oy1, z: oz1 }, { x: ox1, y: oy0, z: oz1 })
    this.addQuad({ x: ox0, y: oy0, z: oz1 }, { x: ix0, y: iy0, z: iz1 }, { x: ix0, y: iy1, z: iz1 }, { x: ox0, y: oy1, z: oz1 })
    this.addQuad({ x: ix0, y: iy0, z: iz1 }, { x: ix1, y: iy0, z: iz1 }, { x: ix1, y: iy1, z: iz1 }, { x: ix0, y: iy1, z: iz1 })
    this.addQuad({ x: ix1, y: iy0, z: iz1 }, { x: ox1, y: oy0, z: oz1 }, { x: ox1, y: oy1, z: oz1 }, { x: ix1, y: iy1, z: iz1 })

    // Front wall (z-) — solid panel (baffle), driver cutouts handled separately
    this.addQuad({ x: ox0, y: oy0, z: oz0 }, { x: ox0, y: oy1, z: oz0 }, { x: ox1, y: oy1, z: oz0 }, { x: ox1, y: oy0, z: oz0 })
    this.addQuad({ x: ox0, y: oy0, z: oz0 }, { x: ix0, y: iy0, z: iz0 }, { x: ix0, y: iy1, z: iz0 }, { x: ox0, y: oy1, z: oz0 })
    this.addQuad({ x: ix0, y: iy0, z: iz0 }, { x: ix1, y: iy0, z: iz0 }, { x: ix1, y: iy1, z: iz0 }, { x: ix0, y: iy1, z: iz0 })
    this.addQuad({ x: ix1, y: iy0, z: iz0 }, { x: ix1, y: iy1, z: iz0 }, { x: ox1, y: oy1, z: oz0 }, { x: ox1, y: oy0, z: oz0 })
  }

  /**
   * Add a cylindrical hole (driver cutout) in a panel.
   * Approximated as a ring of triangles. This creates the inner wall of the hole.
   * The panel itself should already exist; this adds the cylindrical inner surface.
   */
  addCylinderWall(centerX: number, centerY: number, z: number, radius: number, depth: number, segments: number = 32): void {
    for (let i = 0; i < segments; i++) {
      const a1 = (i / segments) * Math.PI * 2
      const a2 = ((i + 1) / segments) * Math.PI * 2
      const x1 = centerX + Math.cos(a1) * radius
      const y1 = centerY + Math.sin(a1) * radius
      const x2 = centerX + Math.cos(a2) * radius
      const y2 = centerY + Math.sin(a2) * radius

      this.addQuad(
        { x: x1, y: y1, z },
        { x: x1, y: y1, z: z + depth },
        { x: x2, y: y2, z: z + depth },
        { x: x2, y: y2, z },
      )
    }
  }

  /**
   * Add a flat baffle panel with circular driver cutouts.
   * The panel is a quad with holes approximated by triangulating around each cutout.
   * For simplicity, we output the panel as a solid quad plus cylinder walls for the holes.
   */
  addBaffleWithCutouts(
    width: number,
    height: number,
    thickness: number,
    cutouts: { x: number; y: number; radius: number }[],
  ): void {
    // Baffle panel centered at origin, front face at z=0
    const hw = width / 2
    const hh = height / 2

    // Front face (z=0) — solid quad
    this.addQuad(
      { x: -hw, y: -hh, z: 0 },
      { x: -hw, y: hh, z: 0 },
      { x: hw, y: hh, z: 0 },
      { x: hw, y: -hh, z: 0 },
    )
    // Back face (z=thickness)
    this.addQuad(
      { x: -hw, y: -hh, z: thickness },
      { x: hw, y: -hh, z: thickness },
      { x: hw, y: hh, z: thickness },
      { x: -hw, y: hh, z: thickness },
    )
    // Edges (4 sides)
    this.addQuad({ x: -hw, y: -hh, z: 0 }, { x: hw, y: -hh, z: 0 }, { x: hw, y: -hh, z: thickness }, { x: -hw, y: -hh, z: thickness })
    this.addQuad({ x: hw, y: -hh, z: 0 }, { x: hw, y: hh, z: 0 }, { x: hw, y: hh, z: thickness }, { x: hw, y: -hh, z: thickness })
    this.addQuad({ x: hw, y: hh, z: 0 }, { x: -hw, y: hh, z: 0 }, { x: -hw, y: hh, z: thickness }, { x: hw, y: hh, z: thickness })
    this.addQuad({ x: -hw, y: hh, z: 0 }, { x: -hw, y: -hh, z: 0 }, { x: -hw, y: -hh, z: thickness }, { x: -hw, y: hh, z: thickness })

    // Cylinder walls for each cutout (through the full baffle thickness)
    for (const c of cutouts) {
      this.addCylinderWall(c.x, c.y, 0, c.radius, thickness, 48)
    }
  }

  /** Export as binary STL ArrayBuffer. */
  toBinarySTL(): ArrayBuffer {
    const numTriangles = this.triangles.length
    // 80-byte header + 4-byte count + 50 bytes per triangle
    const buffer = new ArrayBuffer(84 + numTriangles * 50)
    const view = new DataView(buffer)

    // Header (80 bytes, unused)
    // (already zeroed)

    // Triangle count
    view.setUint32(80, numTriangles, true)

    let offset = 84
    for (const tri of this.triangles) {
      // Normal (3 floats)
      view.setFloat32(offset, tri.normal.x, true); offset += 4
      view.setFloat32(offset, tri.normal.y, true); offset += 4
      view.setFloat32(offset, tri.normal.z, true); offset += 4
      // Vertices (9 floats)
      view.setFloat32(offset, tri.v1.x, true); offset += 4
      view.setFloat32(offset, tri.v1.y, true); offset += 4
      view.setFloat32(offset, tri.v1.z, true); offset += 4
      view.setFloat32(offset, tri.v2.x, true); offset += 4
      view.setFloat32(offset, tri.v2.y, true); offset += 4
      view.setFloat32(offset, tri.v2.z, true); offset += 4
      view.setFloat32(offset, tri.v3.x, true); offset += 4
      view.setFloat32(offset, tri.v3.y, true); offset += 4
      view.setFloat32(offset, tri.v3.z, true); offset += 4
      // Attribute byte count (2 bytes, unused)
      view.setUint16(offset, 0, true); offset += 2
    }

    return buffer
  }

  get triangleCount(): number {
    return this.triangles.length
  }
}

// ---------------------------------------------------------------------------
// Math helpers
// ---------------------------------------------------------------------------

function computeNormal(v1: Vec3, v2: Vec3, v3: Vec3): Vec3 {
  const ux = v2.x - v1.x
  const uy = v2.y - v1.y
  const uz = v2.z - v1.z
  const wx = v3.x - v1.x
  const wy = v3.y - v1.y
  const wz = v3.z - v1.z
  // Cross product
  const nx = uy * wz - uz * wy
  const ny = uz * wx - ux * wz
  const nz = ux * wy - uy * wx
  // Normalize
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
  return { x: nx / len, y: ny / len, z: nz / len }
}

// ---------------------------------------------------------------------------
// Public API: cabinet STL export
// ---------------------------------------------------------------------------

export interface CabinetSTLOptions {
  width: number       // external mm
  height: number      // external mm
  depth: number       // external mm
  wallThickness: number // mm
  baffleWidth: number   // mm
  baffleHeight: number  // mm
  driverCutouts: { x: number; y: number; radius: number }[] // relative to baffle center
  includeBaffle: boolean
  includeShell: boolean
}

/**
 * Generate a binary STL for the speaker cabinet.
 * The cabinet is modeled in mm, centered at origin, Y-up.
 * Baffle is at the front (z = depth/2).
 */
export function exportCabinetSTL(opts: CabinetSTLOptions): ArrayBuffer {
  const mb = new MeshBuilder()

  const hw = opts.width / 2
  const hh = opts.height / 2
  const hd = opts.depth / 2

  if (opts.includeShell) {
    // Hollow box (all walls except baffle, which is handled separately if requested)
    mb.addHollowBox(
      { x: -hw, y: -hh, z: -hd },
      { x: hw, y: hh, z: hd },
      opts.wallThickness,
    )
  }

  if (opts.includeBaffle) {
    // Baffle panel at front, centered, with driver cutouts
    // Cutout coordinates: x from baffle center, y from baffle center
    // We need to position the baffle at z = hd (front face)
    // But addBaffleWithCutouts creates a panel from z=0 to z=thickness
    // So we create a separate mesh and translate
    const baffleMb = new MeshBuilder()
    baffleMb.addBaffleWithCutouts(
      opts.baffleWidth,
      opts.baffleHeight,
      opts.wallThickness,
      opts.driverCutouts,
    )

    // We need to merge: but since MeshBuilder is internal, we rebuild here
    // For simplicity, directly add baffle quads with z offset = hd - wallThickness/2
    // Actually, let's just add the baffle at the front
    const zFront = hd - opts.wallThickness // front inner surface
    const baffleThickness = opts.wallThickness

    // Create baffle at front position
    const bhw = opts.baffleWidth / 2
    const bhh = opts.baffleHeight / 2

    // Front face of baffle
    mb.addQuad(
      { x: -bhw, y: -bhh, z: zFront },
      { x: -bhw, y: bhh, z: zFront },
      { x: bhw, y: bhh, z: zFront },
      { x: bhw, y: -bhh, z: zFront },
    )
    // Back face
    mb.addQuad(
      { x: -bhw, y: -bhh, z: zFront + baffleThickness },
      { x: bhw, y: -bhh, z: zFront + baffleThickness },
      { x: bhw, y: bhh, z: zFront + baffleThickness },
      { x: -bhw, y: bhh, z: zFront + baffleThickness },
    )
    // Edges
    mb.addQuad({ x: -bhw, y: -bhh, z: zFront }, { x: bhw, y: -bhh, z: zFront }, { x: bhw, y: -bhh, z: zFront + baffleThickness }, { x: -bhw, y: -bhh, z: zFront + baffleThickness })
    mb.addQuad({ x: bhw, y: -bhh, z: zFront }, { x: bhw, y: bhh, z: zFront }, { x: bhw, y: bhh, z: zFront + baffleThickness }, { x: bhw, y: -bhh, z: zFront + baffleThickness })
    mb.addQuad({ x: bhw, y: bhh, z: zFront }, { x: -bhw, y: bhh, z: zFront }, { x: -bhw, y: bhh, z: zFront + baffleThickness }, { x: bhw, y: bhh, z: zFront + baffleThickness })
    mb.addQuad({ x: -bhw, y: bhh, z: zFront }, { x: -bhw, y: -bhh, z: zFront }, { x: -bhw, y: -bhh, z: zFront + baffleThickness }, { x: -bhw, y: bhh, z: zFront + baffleThickness })

    // Cutout cylinder walls
    for (const c of opts.driverCutouts) {
      mb.addCylinderWall(c.x, c.y, zFront, c.radius, baffleThickness, 48)
    }
  }

  return mb.toBinarySTL()
}

/**
 * Trigger a browser download of a binary STL file.
 */
export function downloadSTL(buffer: ArrayBuffer, filename: string): void {
  const blob = new Blob([buffer], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
