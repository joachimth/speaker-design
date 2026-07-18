// Panel resonance, damping, and cabinet material trade-offs
//
// A loudspeaker enclosure wall behaves as a thin plate clamped along its
// edges (glued into the box). Excited by internal pressure and driver
// reaction force, it rings at its own bending-mode frequencies and radiates
// that energy as coloration. The design goals are, in order:
//
//   1. Push the fundamental panel mode HIGH (out of / above the driver's band)
//      -> governed by stiffness: bending rigidity scales with t^3.
//   2. Make whatever resonance remains WEAK and SHORT (low Q, fast decay)
//      -> governed by the loss factor (material damping + applied treatment).
//   3. Kill internal standing waves in the air
//      -> governed by acoustic absorption (fill), INDEPENDENT of wall thickness.
//
// These are three separate mechanisms. Thickness/bracing addresses (1);
// damping treatment addresses (2); stuffing addresses (3). One cannot
// substitute for another.
//
// Model for (1): thin-plate theory, fundamental mode of a rectangular plate
// clamped on all four edges (Blevins, "Formulas for Natural Frequency and
// Mode Shape"; Warburton 1954). We use the practical clamped-edge form:
//
//   D  = E t^3 / (12 (1 - nu^2))          bending rigidity per unit width
//   mu = rho t                            mass per unit area
//   f11 = (pi/2) sqrt(D/mu) * sqrt( (1/a^2)^2 + (1/b^2)^2
//                                    + 2/(a^2 b^2) ) * k_clamp
//
// with k_clamp ~= 1.13 lifting the simply-supported result toward the
// clamped-clamped case. Absolute values are +/-15-20%; the RATIOS between
// materials, thicknesses and brace counts (which drive the design decision)
// are robust.
//
// A transverse brace that divides a panel into N fields shortens the free
// span. To first order the governing dimension b becomes b/N, which is why
// bracing is dramatically more mass-efficient than thickening.

export type PanelMaterialKey =
  | 'mdf'
  | 'birch_ply'
  | 'pine'
  | 'particleboard'
  | 'baltic_birch'

export interface PanelMaterial {
  key: PanelMaterialKey
  name: string
  /** Young's modulus [Pa] */
  E: number
  /** Density [kg/m^3] */
  rho: number
  /** Intrinsic loss factor (undamped, bare panel) [-] */
  eta: number
  /** Indicative price [DKK per m^2 per mm thickness] */
  pricePerM2PerMm: number
}

// Typical engineering values. Wood is anisotropic and batch-variable, so
// these are representative rather than exact. Prices are Danish retail
// ballpark (2026) normalised per mm so any thickness scales linearly.
export const PANEL_MATERIALS: Record<PanelMaterialKey, PanelMaterial> = {
  mdf: {
    key: 'mdf',
    name: 'MDF',
    E: 3.6e9,
    rho: 750,
    eta: 0.02,
    pricePerM2PerMm: 8.5,
  },
  birch_ply: {
    key: 'birch_ply',
    name: 'Birke-krydsfiner',
    E: 10.0e9,
    rho: 680,
    eta: 0.015,
    pricePerM2PerMm: 22,
  },
  baltic_birch: {
    key: 'baltic_birch',
    name: 'Baltisk birk (multiplex)',
    E: 11.5e9,
    rho: 700,
    eta: 0.016,
    pricePerM2PerMm: 28,
  },
  pine: {
    key: 'pine',
    name: 'Fyr (massiv)',
    E: 9.0e9,
    rho: 500,
    eta: 0.012,
    pricePerM2PerMm: 14,
  },
  particleboard: {
    key: 'particleboard',
    name: 'Spånplade',
    E: 3.0e9,
    rho: 680,
    eta: 0.02,
    pricePerM2PerMm: 6,
  },
}

const NU = 0.3 // Poisson's ratio (typical for wood-based sheet)
const K_CLAMP = 1.13 // clamped-edge correction on the simply-supported form
const C_AIR = 343 // speed of sound [m/s]

/**
 * Fundamental (1,1) bending resonance of a clamped rectangular panel [Hz].
 *
 * @param material  panel material
 * @param thickness_mm  panel thickness [mm]
 * @param a_mm  first free span [mm] (e.g. cabinet depth for a side panel)
 * @param b_mm  second free span [mm] (e.g. field height between braces)
 */
export function panelFundamental(
  material: PanelMaterial,
  thickness_mm: number,
  a_mm: number,
  b_mm: number
): number {
  const t = thickness_mm / 1000
  const a = a_mm / 1000
  const b = b_mm / 1000
  const D = (material.E * t ** 3) / (12 * (1 - NU * NU))
  const mu = material.rho * t
  const shape = Math.sqrt(
    (1 / a ** 2) ** 2 + (1 / b ** 2) ** 2 + 2 / (a ** 2 * b ** 2)
  )
  return (Math.PI / 2) * Math.sqrt(D / mu) * shape * K_CLAMP
}

/**
 * Effective loss factor of a wall after an applied damping treatment.
 *
 * - 'none'        : bare panel (material intrinsic eta)
 * - 'bitumen'     : single constrained/free-layer bitumen pad, ~+0.035
 * - 'cld'         : constrained-layer damping (two half-thickness skins
 *                   bonded with a viscoelastic layer, e.g. green glue).
 *                   Same total thickness and bending stiffness as a solid
 *                   panel of equal total thickness, but ~10x the loss factor.
 */
export type DampingTreatment = 'none' | 'bitumen' | 'cld'

export function effectiveLossFactor(
  material: PanelMaterial,
  treatment: DampingTreatment
): number {
  switch (treatment) {
    case 'bitumen':
      return material.eta + 0.035
    case 'cld':
      // CLD does not reach a fixed eta; it multiplies intrinsic damping and
      // adds a large viscoelastic term. ~0.15 is a realistic well-executed
      // green-glue result and is used as a representative value.
      return Math.max(0.15, material.eta * 10)
    case 'none':
    default:
      return material.eta
  }
}

/** Resonance quality factor from loss factor: Q = 1/eta. */
export function panelQ(eta: number): number {
  return 1 / eta
}

/**
 * 60 dB decay time of a panel resonance [ms].
 *
 * Treating the panel mode as a lightly damped resonator, the reverberation-
 * style decay is T60 ~= 2.2 / (f * eta). Lower is better (less ringing tail).
 */
export function panelDecayMs(freqHz: number, eta: number): number {
  if (freqHz <= 0 || eta <= 0) return Infinity
  return (2.2 / (freqHz * eta)) * 1000
}

/** First axial standing-wave frequency for an internal air dimension [Hz]. */
export function standingWave(dimension_mm: number): number {
  if (dimension_mm <= 0) return Infinity
  return C_AIR / (2 * (dimension_mm / 1000))
}

export interface PanelConfigInput {
  material: PanelMaterial
  thickness_mm: number
  /** Free span perpendicular to the braces (constant) [mm] */
  spanA_mm: number
  /** Full panel length that braces subdivide [mm] */
  spanB_mm: number
  /** Number of transverse braces (0 = undivided panel) */
  braces: number
  treatment: DampingTreatment
  /** True if this panel physically carries a driver (needs a stiffness floor) */
  driverBearing?: boolean
}

export interface PanelConfigResult {
  fieldHeight_mm: number
  fundamentalHz: number
  eta: number
  q: number
  decayMs: number
  massKg: number
  /** Qualitative verdict for the UI */
  verdict: 'good' | 'ok' | 'poor'
  note: string
}

/**
 * Evaluate one panel configuration end-to-end.
 *
 * Bracing divides spanB into (braces + 1) fields; the governing field height
 * is spanB / (braces + 1). A driver-bearing panel is held to a higher bar
 * because it also reacts the moving-mass force, not just internal pressure.
 */
export function evaluatePanel(cfg: PanelConfigInput): PanelConfigResult {
  const fields = cfg.braces + 1
  const fieldHeight = cfg.spanB_mm / fields
  const f = panelFundamental(
    cfg.material,
    cfg.thickness_mm,
    cfg.spanA_mm,
    fieldHeight
  )
  const eta = effectiveLossFactor(cfg.material, cfg.treatment)
  const q = panelQ(eta)
  const decay = panelDecayMs(f, eta)

  // Panel mass (single face). Braces add area separately at the cabinet level.
  const massKg =
    cfg.material.rho *
    (cfg.thickness_mm / 1000) *
    (cfg.spanA_mm / 1000) *
    (cfg.spanB_mm / 1000)

  // Verdict thresholds. Aim to keep the fundamental above the midband; a
  // driver-bearing wall gets a stricter floor because its excitation is
  // stronger and directly coupled.
  const goodFloor = cfg.driverBearing ? 380 : 300
  const okFloor = cfg.driverBearing ? 260 : 200

  let verdict: PanelConfigResult['verdict']
  let note: string
  if (f >= goodFloor) {
    verdict = 'good'
    note =
      'Grundtonen ligger højt nok til at være ude af det kritiske område.'
  } else if (f >= okFloor) {
    verdict = 'ok'
    note =
      'Acceptabelt, men grundtonen er lav — overvej en brace mere eller dæmpning.'
  } else {
    verdict = 'poor'
    note =
      'Grundtonen ligger midt i mellemtonen. Tilføj afstivning eller øg tykkelsen.'
  }

  if (cfg.driverBearing && cfg.thickness_mm < 15) {
    note +=
      ' Denne plade bærer en enhed — under 15 mm bliver montering/stivhed usikker.'
  }

  return {
    fieldHeight_mm: fieldHeight,
    fundamentalHz: f,
    eta,
    q,
    decayMs: decay,
    massKg,
    verdict,
    note,
  }
}

export interface CabinetCostInput {
  material: PanelMaterial
  thickness_mm: number
  width_mm: number
  height_mm: number
  depth_mm: number
  /** Total transverse braces in the cabinet (all panels) */
  braces: number
  /** Brace thickness [mm] (defaults to wall thickness) */
  braceThickness_mm?: number
}

export interface CabinetCostResult {
  wallAreaM2: number
  braceAreaM2: number
  totalAreaM2: number
  boardCostDkk: number
  wallMassKg: number
}

/**
 * Board area, cost and mass for one cabinet (six outer faces + braces).
 *
 * A brace spans the internal cross-section; we approximate its area as
 * width x depth. Cost scales linearly with thickness via the per-mm price.
 */
export function cabinetBoardCost(cfg: CabinetCostInput): CabinetCostResult {
  const W = cfg.width_mm / 1000
  const H = cfg.height_mm / 1000
  const D = cfg.depth_mm / 1000
  const wallArea = 2 * (D * H) + 2 * (W * H) + 2 * (W * D)
  const braceArea = cfg.braces * (W * D)
  const totalArea = wallArea + braceArea

  const braceT = cfg.braceThickness_mm ?? cfg.thickness_mm
  const wallCost = wallArea * cfg.material.pricePerM2PerMm * cfg.thickness_mm
  const braceCost = braceArea * cfg.material.pricePerM2PerMm * braceT
  const boardCost = wallCost + braceCost

  const wallMass =
    cfg.material.rho * (cfg.thickness_mm / 1000) * wallArea

  return {
    wallAreaM2: wallArea,
    braceAreaM2: braceArea,
    totalAreaM2: totalArea,
    boardCostDkk: boardCost,
    wallMassKg: wallMass,
  }
}
