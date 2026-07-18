import { useMemo, useState } from 'react'
import { Card, Select, NumberInput, StatCard } from '@/components/common/UI'
import {
  PANEL_MATERIALS,
  type PanelMaterialKey,
  type DampingTreatment,
  evaluatePanel,
  cabinetBoardCost,
  standingWave,
  type PanelConfigResult,
} from '@/lib/acoustic/panelResonance'

interface Props {
  /** Outer cabinet width [mm] */
  width: number
  /** Outer cabinet height [mm] */
  height: number
  /** Outer cabinet depth [mm] */
  depth: number
  /** Wall thickness from the dimensions card [mm] */
  wallThickness: number
}

const VERDICT_STYLES: Record<PanelConfigResult['verdict'], string> = {
  good: 'text-green-700 dark:text-green-400',
  ok: 'text-amber-600 dark:text-amber-400',
  poor: 'text-red-600 dark:text-red-400',
}
const VERDICT_LABEL: Record<PanelConfigResult['verdict'], string> = {
  good: 'God',
  ok: 'OK',
  poor: 'Svag',
}

function VerdictRow({ result }: { result: PanelConfigResult }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        <div className="text-xs text-gray-500 dark:text-gray-400">Grundtone</div>
        <div className={`text-lg font-semibold ${VERDICT_STYLES[result.verdict]}`}>
          {result.fundamentalHz.toFixed(0)}{' '}
          <span className="text-sm text-gray-500">Hz · {VERDICT_LABEL[result.verdict]}</span>
        </div>
      </div>
      <StatCard label="Q (skarphed)" value={result.q.toFixed(1)} />
      <StatCard label="Efterringning" value={result.decayMs.toFixed(0)} unit="ms" />
      <StatCard label="Felthøjde" value={result.fieldHeight_mm.toFixed(0)} unit="mm" />
    </div>
  )
}

export default function PanelResonanceCard({ width, height, depth, wallThickness }: Props) {
  const [materialKey, setMaterialKey] = useState<PanelMaterialKey>('birch_ply')
  const [thickness, setThickness] = useState<number>(wallThickness || 22)
  const [sideBraces, setSideBraces] = useState<number>(2)
  const [treatment, setTreatment] = useState<DampingTreatment>('none')

  // Midrange chamber: a small enclosed volume behind the mid on the baffle.
  // Its panels are much smaller, so the user gives its height; width/depth
  // default to a compact share of the cabinet.
  const [midChamberHeight, setMidChamberHeight] = useState<number>(260)
  const [midChamberDepth, setMidChamberDepth] = useState<number>(220)

  const material = PANEL_MATERIALS[materialKey]

  // --- Side panel: DRIVER-BEARING (bass drivers mount here, push-push) ---
  // Free spans: depth x full height, subdivided by transverse braces.
  const sidePanel = useMemo(
    () =>
      evaluatePanel({
        material,
        thickness_mm: thickness,
        spanA_mm: depth,
        spanB_mm: height,
        braces: sideBraces,
        treatment,
        driverBearing: true,
      }),
    [material, thickness, depth, height, sideBraces, treatment]
  )

  // --- Midrange chamber panel: smaller, its own sub-enclosure on the baffle ---
  const midPanel = useMemo(
    () =>
      evaluatePanel({
        material,
        thickness_mm: thickness,
        spanA_mm: Math.min(midChamberDepth, width - 2 * thickness),
        spanB_mm: midChamberHeight,
        braces: 0,
        treatment,
        driverBearing: true,
      }),
    [material, thickness, midChamberDepth, midChamberHeight, width, treatment]
  )

  // --- Economy: total board cost/mass for the cabinet ---
  // Side panels carry the braces; count both sides.
  const cost = useMemo(
    () =>
      cabinetBoardCost({
        material,
        thickness_mm: thickness,
        width_mm: width,
        height_mm: height,
        depth_mm: depth,
        braces: sideBraces * 2,
      }),
    [material, thickness, width, height, depth, sideBraces]
  )

  // Reference: same cabinet at 22mm / 2 braces per side, bare, for a saving %.
  const reference = useMemo(
    () =>
      cabinetBoardCost({
        material,
        thickness_mm: 22,
        width_mm: width,
        height_mm: height,
        depth_mm: depth,
        braces: 4,
      }),
    [material, width, height, depth]
  )
  const savingPct = 100 * (1 - cost.boardCostDkk / reference.boardCostDkk)

  // --- Internal standing waves (independent of wall thickness) ---
  const standing = useMemo(
    () => ({
      height: standingWave(height - 2 * thickness),
      depth: standingWave(depth - 2 * thickness),
      width: standingWave(width - 2 * thickness),
    }),
    [width, height, depth, thickness]
  )

  return (
    <Card title="Panel, materiale & dæmpning">
      <div className="space-y-5">
        {/* Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Select
            label="Materiale"
            value={materialKey}
            onChange={(v) => setMaterialKey(v as PanelMaterialKey)}
            options={Object.values(PANEL_MATERIALS).map((m) => ({ value: m.key, label: m.name }))}
          />
          <NumberInput label="Vægtykkelse" unit="mm" value={thickness} min={6} max={40} onChange={setThickness} />
          <NumberInput label="Braces pr. side" value={sideBraces} min={0} max={6} onChange={setSideBraces} />
          <Select
            label="Dæmpning"
            value={treatment}
            onChange={(v) => setTreatment(v as DampingTreatment)}
            options={[
              { value: 'none', label: 'Ingen' },
              { value: 'bitumen', label: 'Bitumen-plade' },
              { value: 'cld', label: 'CLD (2 lag + grøn lim)' },
            ]}
          />
        </div>

        {/* Side panel — driver-bearing */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Sidepanel — bærer basenhederne
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200">
              driver-bærende
            </span>
          </div>
          <VerdictRow result={sidePanel} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{sidePanel.note}</p>
        </div>

        {/* Midrange chamber */}
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Mellemtonekammer (eget kammer på fronten)
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <NumberInput label="Kammer-højde" unit="mm" value={midChamberHeight} min={120} max={600} onChange={setMidChamberHeight} />
            <NumberInput label="Kammer-dybde" unit="mm" value={midChamberDepth} min={100} max={400} onChange={setMidChamberDepth} />
          </div>
          <VerdictRow result={midPanel} />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Mindre paneler → højere grundtone. Mellemtonekammeret er sjældent det kritiske panel,
            men det skal være helt tæt og gerne bedæmpet, da mellemtonen er øret mest følsomt.
          </p>
        </div>

        {/* Economy */}
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Økonomi (pr. højttaler)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Træpris" value={cost.boardCostDkk.toFixed(0)} unit="kr" />
            <StatCard label="Vægmasse (alle flader)" value={cost.wallMassKg.toFixed(1)} unit="kg" />
            <StatCard label="Pladeareal" value={cost.totalAreaM2.toFixed(2)} unit="m²" />
            <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="text-xs text-gray-500 dark:text-gray-400">vs. 22mm/2-brace</div>
              <div
                className={`text-lg font-semibold ${
                  savingPct > 0 ? 'text-green-700 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {savingPct > 0 ? '−' : '+'}
                {Math.abs(savingPct).toFixed(0)}
                <span className="text-sm text-gray-500"> %</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Priser er vejledende ({material.name}, ~{material.pricePerM2PerMm} kr/m²/mm). Braces koster
            ekstra areal men løfter grundtonen langt billigere end øget tykkelse.
          </p>
        </div>

        {/* Standing waves */}
        <div>
          <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Stående bølger i luften (kræver fyld — uafhængigt af vægtykkelse)
          </div>
          <div className="grid grid-cols-3 gap-3">
            <StatCard label="Højde-mode" value={standing.height.toFixed(0)} unit="Hz" />
            <StatCard label="Dybde-mode" value={standing.depth.toFixed(0)} unit="Hz" />
            <StatCard label="Bredde-mode" value={standing.width.toFixed(0)} unit="Hz" />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Læg akustisk fyld (polyfill/uld) i kabinettet for at dæmpe disse. Dette er en helt anden
            mekanisme end panel-dæmpning og kan ikke erstattes af tykkere vægge.
          </p>
        </div>

        {/* Footnote */}
        <p className="text-[11px] text-gray-400 dark:text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-3">
          Grundtone-frekvenserne er analytiske plade-approksimationer (fastspændte kanter, Blevins/Warburton),
          ±15–20 % absolut. Forholdene mellem materialer, tykkelser og brace-antal er robuste og er dem
          beslutningen bør bygges på. Dæmpning ændrer <em>ikke</em> grundtonen — kun Q og efterringning.
        </p>
      </div>
    </Card>
  )
}
