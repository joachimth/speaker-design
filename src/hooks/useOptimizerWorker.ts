// Hook for offloading optimization to a Web Worker
//
// Usage:
//   const { optimize, optimizing, result } = useOptimizerWorker()
//   optimize({ type: 'preference', params: {...} })
//
// The hook manages a single worker instance and returns the latest result.

import { useState, useRef, useCallback, useEffect } from 'react'
import type { OptimizationResult as PrefOptResult } from '@/lib/acoustic/preferenceOptimizer'
import type { CabinetOptimizationResult } from '@/lib/acoustic/cabinetOptimizer'
import type { OptimizerWorkerInput, OptimizerWorkerOutput } from '../workers/optimizerWorker'

type OptType = 'preference' | 'cabinet'

interface OptimizerState {
  type: OptType | null
  prefResult: PrefOptResult | null
  cabResult: CabinetOptimizationResult | null
  optimizing: boolean
}

export function useOptimizerWorker() {
  const [state, setState] = useState<OptimizerState>({
    type: null,
    prefResult: null,
    cabResult: null,
    optimizing: false,
  })
  const workerRef = useRef<Worker | null>(null)

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/optimizerWorker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<OptimizerWorkerOutput>) => {
      const { type, result } = e.data
      if (type === 'preference') {
        setState((s) => ({ ...s, type: null, prefResult: result as PrefOptResult, optimizing: false }))
      } else if (type === 'cabinet') {
        setState((s) => ({ ...s, type: null, cabResult: result as CabinetOptimizationResult, optimizing: false }))
      }
    }

    worker.onerror = (e) => {
      console.error('Optimizer worker error:', e)
      setState((s) => ({ ...s, type: null, optimizing: false }))
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const optimize = useCallback((input: OptimizerWorkerInput) => {
    if (!workerRef.current) return
    setState((s) => ({ ...s, type: input.type, optimizing: true }))
    // Clear previous result of this type
    if (input.type === 'preference') {
      setState((s) => ({ ...s, prefResult: null }))
    } else {
      setState((s) => ({ ...s, cabResult: null }))
    }
    workerRef.current.postMessage(input)
  }, [])

  return {
    optimize,
    optimizing: state.optimizing,
    optimizeType: state.type,
    prefResult: state.prefResult,
    cabResult: state.cabResult,
  }
}
