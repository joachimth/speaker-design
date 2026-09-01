// Hook for offloading simulation to a Web Worker
//
// Provides a drop-in replacement for the heavy useMemo computation in
// SystemSimulation. Returns { processedBands, summedResponse, loading }.
//
// Usage:
//   const { processedBands, summedResponse, loading } = useSimulationWorker({
//     bands, drivers, ways, baffleWidth, baffleHeight, ...
//   })

import { useState, useEffect, useRef, useCallback } from 'react'
import type { Driver, FrequencyDataPoint, DesignBand } from '@/types'

export interface SimWorkerInput {
  bands: DesignBand[]
  drivers: Driver[]
  ways: number
  baffleWidth: number
  baffleHeight: number
  cabinetType: string
  portFb: number
  portVb: number
  portDiameter: number
  numPorts: number
}

export interface ProcessedBand {
  band: DesignBand
  driverId: string
  curve: FrequencyDataPoint[]
  hasRealResponse: boolean
}

interface SimResult {
  processedBands: ProcessedBand[]
  summedResponse: FrequencyDataPoint[]
  freqs: number[]
}

export function useSimulationWorker(input: SimWorkerInput) {
  const [result, setResult] = useState<SimResult | null>(null)
  const [loading, setLoading] = useState(false)
  const workerRef = useRef<Worker | null>(null)
  const seqRef = useRef(0)

  // Create worker on mount
  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/simulationWorker.ts', import.meta.url),
      { type: 'module' }
    )
    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<SimResult>) => {
      setResult(e.data)
      setLoading(false)
    }

    worker.onerror = (e) => {
      console.error('Simulation worker error:', e)
      setLoading(false)
    }

    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  // Send input to worker when it changes (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const sendToWorker = useCallback((data: SimWorkerInput) => {
    if (!workerRef.current) return
    seqRef.current++
    setLoading(true)
    workerRef.current.postMessage(data)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      sendToWorker(input)
    }, 100) // 100ms debounce
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [input.bands, input.drivers, input.ways, input.baffleWidth, input.baffleHeight,
      input.cabinetType, input.portFb, input.portVb, input.portDiameter, input.numPorts,
      sendToWorker])

  return {
    processedBands: result?.processedBands ?? [],
    summedResponse: result?.summedResponse ?? null,
    freqs: result?.freqs ?? [],
    loading,
  }
}
