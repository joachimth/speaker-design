/**
 * BreakInCard — Shows break-in projection dashboard for DATS-tracked drivers.
 *
 * Displays:
 *   - SVG projection charts (Fs + Qts) with uncertainty corridor
 *   - Measurement schedule with recommendations
 *   - Current status summary
 *   - Fit quality indicator (auto-fit vs hand-tuned)
 *   - Cabinet design impact notes
 *
 * Auto-fits break-in curves from measurement data when 2+ measurements
 * exist, replacing hand-tuned scenarios with data-driven projections.
 */

import { useMemo } from 'react'
import { Card, StatCard, Badge } from '@/components/common/UI'
import BreakInChartCard from '@/components/charts/BreakInChart'
import { getBreakInState, autoFitBreakIn } from '@/lib/acoustic/breakin'
import { projectMilestones } from '@/lib/acoustic/breakin'
import type { BreakInState, FitQuality } from '@/lib/acoustic/breakin'

interface Props {
  driverId: string
  /** Active T/S parameter set name (e.g. "Datasheet", "DATS @5h") */
  activeParameterSet: string
}

export default function BreakInCard({ driverId, activeParameterSet }: Props) {
  const state: BreakInState | null = useMemo(() => getBreakInState(driverId), [driverId])
  const fitQuality: FitQuality | null = useMemo(() => {
    if (!state) return null
    // Re-run auto-fit for quality metrics (getBreakInState already modified
    // the scenarios, but we need to compute fit quality separately)
    const raw = getBreakInState(driverId, false)
    if (!raw) return null
    const result = autoFitBreakIn(raw)
    return result?.fitQuality ?? null
  }, [driverId, state])

  if (!state) return null

  const initial = state.measurements[0]
  const latest = state.measurements[state.measurements.length - 1]

  // Calculate milestones
  const milestones = useMemo(
    () => projectMilestones(
      state.measurements,
      state.scenarios,
      state.recommendedSchedule.map(s => s.hours)
    ),
    [state]
  )

  // Current status: where are we relative to spec?
  const fsPctToSpec = ((initial.fs - latest.fs) / (initial.fs - state.spec.fs) * 100)
  const qtsPctToSpec = ((initial.qts - latest.qts) / (initial.qts - state.spec.qts) * 100)
  const hoursTracked = latest.hours

  // Is the active parameter set a DATS measurement?
  const onDatsSet = activeParameterSet.startsWith('DATS')

  // Next recommended measurement
  const nextMstone = state.recommendedSchedule.find(s => s.hours > hoursTracked)
  const nextMilestone = useMemo(() => {
    if (!nextMstone) return null
    const proj = milestones.find(m => m.hours === nextMstone.hours)
    return proj
  }, [nextMstone, milestones])

  // Is auto-fit active?
  const isAutoFit = state.scenarios[0]?.label === 'Auto-fit (bedste)'

  // Best-fit scenario values for display
  const bestFit = state.scenarios[0]
  const uncertainty = state.scenarios[1]

  return (
    <Card title={`🔬 Break-in tracker — ${state.driverLabel}`}>
      <div className="space-y-4">
        {/* Fit quality header */}
        {isAutoFit && fitQuality && (
          <div className="flex flex-wrap gap-2 items-center text-xs">
            <Badge color="green">Auto-fit</Badge>
            <span className="text-gray-500">
              RMSE: Fs {fitQuality.rmseFs.toFixed(2)} Hz, Qts {fitQuality.rmseQts.toFixed(4)}
            </span>
            <span className="text-gray-400">
              R²: Fs {fitQuality.rSquaredFs.toFixed(3)}, Qts {fitQuality.rSquaredQts.toFixed(3)}
            </span>
            {state.measurements.length >= 3 && fitQuality.rSquaredFs > 0.95 && (
              <Badge color="green">Godt fit</Badge>
            )}
            {state.measurements.length >= 3 && fitQuality.rSquaredFs < 0.8 && (
              <Badge color="orange">Svagt fit — flere data nødvendige</Badge>
            )}
            {bestFit && (
              <span className="text-gray-500">
                Estimeret slut: Fs {bestFit.fsFinal.toFixed(1)} Hz, Qts {bestFit.qtsFinal.toFixed(3)}
              </span>
            )}
          </div>
        )}

        {!isAutoFit && (
          <div className="flex items-center text-xs text-gray-400">
            <Badge color="gray">Gættet kurve</Badge>
            <span className="ml-2">Auto-fit aktiveres når 2+ målinger er tilgængelige</span>
          </div>
        )}

        {/* Current status summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard
            label={`Indkøring (${hoursTracked.toFixed(0)}h)`}
            value={onDatsSet ? 'Måler DATS' : 'Viser datablad'}
          />
          <StatCard
            label="Fs → spec"
            value={`${fsPctToSpec.toFixed(0)}%`}
            unit={`(${state.spec.fs} Hz)`}
          />
          <StatCard
            label="Qts → spec"
            value={`${qtsPctToSpec.toFixed(0)}%`}
            unit={`(${state.spec.qts.toFixed(3)})`}
          />
          <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
            <div className="mt-1">
              {hoursTracked === 0 ? (
                <Badge color="orange">Ikke påbegyndt</Badge>
              ) : fsPctToSpec >= 90 ? (
                <Badge color="green">Sandsynligvis settled</Badge>
              ) : fsPctToSpec >= 50 ? (
                <Badge color="blue">Over halvvejs</Badge>
              ) : (
                <Badge color="orange">Tidlig fase</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Charts */}
        <BreakInChartCard state={state} />

        {/* Measurement schedule */}
        {state.recommendedSchedule.length > 0 && (
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Anbefalet måleplan
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="py-1 pr-3">Timer</th>
                    <th className="py-1 pr-3">Fs</th>
                    <th className="py-1 pr-3">Qts</th>
                    <th className="py-1 pr-3">% af ændring</th>
                    <th className="py-1">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Already measured */}
                  {state.measurements.map((m, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800 text-gray-900 dark:text-gray-100">
                      <td className="py-1.5 pr-3 font-medium">{m.hours.toFixed(0)}h</td>
                      <td className="py-1.5 pr-3">{m.fs.toFixed(1)} Hz</td>
                      <td className="py-1.5 pr-3">{m.qts.toFixed(3)}</td>
                      <td className="py-1.5 pr-3">—</td>
                      <td className="py-1.5 text-gray-500 italic">Målt</td>
                    </tr>
                  ))}
                  {/* Projected */}
                  {milestones.map((m, i) => {
                    const schedule = state.recommendedSchedule[i]
                    if (!schedule) return null
                    const isNext = schedule.hours > hoursTracked && (!nextMstone || schedule.hours === nextMstone.hours)
                    return (
                      <tr
                        key={i}
                        className={`border-b border-gray-100 dark:border-gray-800 ${
                          isNext
                            ? 'bg-brand-50 dark:bg-brand-900/20'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        <td className="py-1.5 pr-3 font-medium">{schedule.hours}h</td>
                        <td className="py-1.5 pr-3">{m.fs.toFixed(1)} Hz</td>
                        <td className="py-1.5 pr-3">{m.qts.toFixed(3)}</td>
                        <td className="py-1.5 pr-3">
                          Fs {m.fsPctOfChange.toFixed(0)}% / Qts {m.qtsPctOfChange.toFixed(0)}%
                        </td>
                        <td className="py-1.5">
                          {isNext ? (
                            <Badge color="blue">Næste</Badge>
                          ) : (
                            <span className="text-gray-500">{schedule.label}</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Next measurement recommendation */}
        {nextMilestone && (
          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-md p-3">
            <div className="text-sm font-medium text-brand-800 dark:text-brand-200">
              Anbefalet næste måling: {nextMstone!.hours}h
            </div>
            <div className="text-xs text-brand-600 dark:text-brand-400 mt-1">
              Forventet: Fs ≈ {nextMilestone.fs.toFixed(1)} Hz, Qts ≈ {nextMilestone.qts.toFixed(3)}<br />
              (ca. {nextMilestone.fsPctOfChange.toFixed(0)}% af Fs-ændring gennemført){isAutoFit && (
                <> — kurven er data-drevet, estimatet bliver skarpere med flere målinger</>
              )}<br />
              {!isAutoFit && <>Brug sidste måling som nyt referencepunkt: Hvis Fs er lavere end forventet, justér den konservative kurve opad.</>}
              {isAutoFit && bestFit && uncertainty && (
                <>Usikkerhed: Fs mellem {projectNextFs(bestFit, nextMstone!.hours, initial.fs)} og {projectNextFs(uncertainty, nextMstone!.hours, initial.fs)} Hz</>
              )}
            </div>
          </div>
        )}

        {/* Driver-specific notes */}
        {driverId === 'seed-scanspeak-18w-4424g00' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
            <strong>Bemærk:</strong> 18W/4424G00 har +42% Fs ved 0h. Dette er ekstremt for en ScanSpeak
            driver — normalt er break-in 10-20%. Det kan skyldes en særlig stiv suspensionsbatch,
            eller driveren har brugt længere tid på lager. DATS-måling bekræfter at det ikke er
            en målefejl. Fortsæt break-in og genmål ved 10h og 15h. Auto-fit justerer sig efter
            hver ny måling, så kurven bliver mere præcis efterhånden som data tikker ind.
          </p>
        )}
        {driverId === 'seed-grs-12sw-4he' && (
          <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-200 dark:border-gray-700 pt-3">
            <strong>Bemærk:</strong> GRS 12SW-4HE's Qts faldt 13.7% på de første 5h (fra 0.512 til 0.442),
            mod 18W'ens 3.7%. Billige gummikanter og papirmembraner har ofte hurtigere indkøring end
            avancerede coatede membraner. Mål den anden 12SW for at sikre push-push parring (Qts match
            indenfor ±0.03). Hvis den anden driver afviger, placer den med højere Qts bagi.
          </p>
        )}
      </div>
    </Card>
  )
}

/** Compute projected Fs at a milestone for display */
function projectNextFs(
  scenario: { tauFs: number; fsFinal: number },
  hours: number,
  fsInitial: number
): string {
  const val = scenario.fsFinal + (fsInitial - scenario.fsFinal) * Math.exp(-hours / scenario.tauFs)
  return val.toFixed(1)
}
