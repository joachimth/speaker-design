// Web Worker for preference score optimization and cabinet optimization
//
// Offloads heavy optimization loops from the main thread so the UI stays
// responsive (shows progress, doesn't freeze).

import { optimizeForPreferenceScore, type OptimizationParams } from '../lib/acoustic/preferenceOptimizer'
import { optimizeCabinetForDrivers, type CabinetOptimizationParams } from '../lib/acoustic/cabinetOptimizer'
import type { OptimizationResult as PrefOptResult } from '../lib/acoustic/preferenceOptimizer'
import type { CabinetOptimizationResult } from '../lib/acoustic/cabinetOptimizer'

export interface OptimizerWorkerInput {
  type: 'preference' | 'cabinet'
  params: OptimizationParams | CabinetOptimizationParams
}

export interface OptimizerWorkerOutput {
  type: 'preference' | 'cabinet'
  result: PrefOptResult | CabinetOptimizationResult
}

self.onmessage = (e: MessageEvent<OptimizerWorkerInput>) => {
  const { type, params } = e.data

  if (type === 'preference') {
    const result = optimizeForPreferenceScore(params as OptimizationParams)
    ;(self as unknown as Worker).postMessage({ type: 'preference', result } as OptimizerWorkerOutput)
  } else if (type === 'cabinet') {
    const result = optimizeCabinetForDrivers(params as CabinetOptimizationParams)
    ;(self as unknown as Worker).postMessage({ type: 'cabinet', result } as OptimizerWorkerOutput)
  }
}
