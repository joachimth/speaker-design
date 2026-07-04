import { useState, useRef } from 'react'
import { useDriverStore } from '@/store/driverStore'
import { Card, Button, Badge, Select } from '@/components/common/UI'
import { extractPdf, type PdfExtractionResult } from '@/lib/pdf/extractor'
import { recommendCabinetType } from '@/lib/acoustic/thieleSmall'
import type { Driver, DriverType } from '@/types'

const DRIVER_TYPE_COLORS: Record<DriverType, 'gray' | 'green' | 'blue' | 'orange' | 'red'> = {
  woofer: 'orange',
  subwoofer: 'red',
  midrange: 'green',
  tweeter: 'blue',
  fullrange: 'gray',
}

const DRIVER_TYPE_LABELS: Record<DriverType, string> = {
  woofer: 'Woofer',
  subwoofer: 'Subwoofer',
  midrange: 'Midrange',
  tweeter: 'Tweeter',
  fullrange: 'Full-range',
}

export default function DriverManager() {
  const { drivers, addDriver, removeDriver, loading } = useDriverStore()
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [extraction, setExtraction] = useState<PdfExtractionResult | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [newDriver, setNewDriver] = useState<Partial<Driver>>({
    manufacturer: '',
    model: '',
    type: 'woofer',
  })
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setExtracting(true)
    try {
      const buffer = await file.arrayBuffer()
      const result = await extractPdf(buffer)
      setExtraction(result)

      // Auto-fill driver info from extracted params
      const ts = result.tsParams
      setNewDriver((prev) => ({
        ...prev,
        tsParams: ts as any,
        manufacturer: prev.manufacturer || '',
        model: prev.model || '',
        datasheetPdf: buffer,
      }))
    } catch (err: any) {
      alert(`Fejl ved PDF-ekstraktion: ${err.message}`)
    } finally {
      setExtracting(false)
    }
  }

  function handleSaveDriver() {
    if (!newDriver.manufacturer || !newDriver.model) {
      alert('Udfyld producent og model')
      return
    }
    const driver: Driver = {
      id: `driver-${Date.now()}`,
      manufacturer: newDriver.manufacturer || '',
      model: newDriver.model || '',
      type: (newDriver.type as DriverType) || 'woofer',
      tsParams: (newDriver.tsParams as any) || {} as any,
      dimensions: newDriver.dimensions,
      frequencyResponse: newDriver.frequencyResponse,
      impedance: newDriver.impedance,
      notes: newDriver.notes || '',
      datasheetPdf: newDriver.datasheetPdf,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    addDriver(driver)
    setNewDriver({ manufacturer: '', model: '', type: 'woofer' })
    setExtraction(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Enheder</h2>
        <span className="text-sm text-gray-500">{drivers.length} enheder</span>
      </div>

      {/* Upload section */}
      <Card title="Upload datablad">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Upload en PDF fra producenten. Softwaren forsøger automatisk at udtrække Thiele-Small parametre.
            For datablade med indlejrede grafer (frekvensgang, impedance) kan kurverne digitaliseres manuelt.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
          />
          {extracting && <div className="text-sm text-brand-600">Udtrækker data fra PDF...</div>}

          {extraction && (
            <div className="mt-4 space-y-3">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-md p-3">
                <div className="text-sm font-medium text-green-800 dark:text-green-200">
                  Udtrukket fra {extraction.numPages} side(r)
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {extraction.images.length} billede(r) fundet. T/S parametre udtrukket nedenfor.
                </div>
              </div>

              {/* Extracted images */}
              {extraction.images.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-2">Billeder fra PDF (grafer til digitalisering):</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {extraction.images.slice(0, 6).map((img, i) => (
                      <div key={i} className="border border-gray-200 dark:border-gray-700 rounded overflow-hidden">
                        <img src={img.dataUrl} alt={`Billede ${i + 1}`} className="w-full h-auto" />
                        <div className="text-xs text-gray-400 px-1 py-0.5">Side {img.pageIndex}, {img.width}x{img.height}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Driver info form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Producent</label>
                  <input
                    type="text"
                    value={newDriver.manufacturer || ''}
                    onChange={(e) => setNewDriver({ ...newDriver, manufacturer: e.target.value })}
                    placeholder="f.eks. ScanSpeak"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Model</label>
                  <input
                    type="text"
                    value={newDriver.model || ''}
                    onChange={(e) => setNewDriver({ ...newDriver, model: e.target.value })}
                    placeholder="f.eks. 15W/4434G00"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm"
                  />
                </div>
              </div>

              <Select
                label="Type"
                value={newDriver.type || 'woofer'}
                onChange={(v) => setNewDriver({ ...newDriver, type: v as DriverType })}
                options={[
                  { value: 'woofer', label: 'Woofer' },
                  { value: 'subwoofer', label: 'Subwoofer' },
                  { value: 'midrange', label: 'Midrange' },
                  { value: 'tweeter', label: 'Tweeter' },
                  { value: 'fullrange', label: 'Full-range' },
                ]}
              />

              {/* Extracted T/S params */}
              {extraction.tsParams && Object.keys(extraction.tsParams).length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-600 mb-2">Udtrukne Thiele-Small parametre:</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(extraction.tsParams).map(([key, value]) => (
                      <div key={key} className="bg-gray-50 dark:bg-gray-750 rounded p-2 text-xs">
                        <div className="text-gray-500">{key}</div>
                        <div className="font-medium">{String(value)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={handleSaveDriver} disabled={!newDriver.manufacturer || !newDriver.model}>
                Gem enhed
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Driver list */}
      <Card title="Gemte enheder">
        {loading ? (
          <div className="text-sm text-gray-500">Indlæser...</div>
        ) : drivers.length === 0 ? (
          <div className="text-sm text-gray-500">Ingen enheder. Upload et datablad for at komme i gang.</div>
        ) : (
          <div className="space-y-2">
            {drivers.map((driver) => {
              const rec = driver.tsParams?.qts ? recommendCabinetType(driver.tsParams) : null
              return (
                <div
                  key={driver.id}
                  className="flex items-center justify-between p-3 rounded-md border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 cursor-pointer"
                  onClick={() => setSelectedDriver(driver)}
                >
                  <div className="flex items-center gap-3">
                    <Badge color={DRIVER_TYPE_COLORS[driver.type]}>{DRIVER_TYPE_LABELS[driver.type]}</Badge>
                    <div>
                      <div className="font-medium text-sm text-gray-900 dark:text-gray-100">
                        {driver.manufacturer} {driver.model}
                      </div>
                      <div className="text-xs text-gray-500">
                        {driver.tsParams?.fs && `Fs ${driver.tsParams.fs}Hz · `}
                        {driver.tsParams?.qts && `Qts ${driver.tsParams.qts} · `}
                        {driver.tsParams?.vas && `Vas ${driver.tsParams.vas}L`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {rec && <span className="text-xs text-gray-400">{rec.recommended}</span>}
                    <Button variant="danger" size="sm" onClick={() => { removeDriver(driver.id) }}>
                      Slet
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Driver detail */}
      {selectedDriver && (
        <DriverDetail driver={selectedDriver} onClose={() => setSelectedDriver(null)} />
      )}
    </div>
  )
}

function DriverDetail({ driver, onClose }: { driver: Driver; onClose: () => void }) {
  const ts = driver.tsParams
  const rec = ts?.qts ? recommendCabinetType(ts) : null

  return (
    <Card
      title={`${driver.manufacturer} ${driver.model}`}
      className="mt-4"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge color={DRIVER_TYPE_COLORS[driver.type]}>{DRIVER_TYPE_LABELS[driver.type]}</Badge>
          <Button variant="ghost" size="sm" onClick={onClose}>Luk</Button>
        </div>

        {ts && (
          <div>
            <h4 className="text-sm font-medium mb-2">Thiele-Small parametre</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {Object.entries(ts).filter(([_, v]) => v != null).map(([key, value]) => (
                <div key={key} className="bg-gray-50 dark:bg-gray-750 rounded p-2">
                  <div className="text-xs text-gray-500">{key}</div>
                  <div className="text-sm font-medium">{String(value)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {rec && (
          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-md p-3">
            <div className="text-sm font-medium text-brand-800 dark:text-brand-200">
              Anbefalet kabinet: {rec.recommended}
            </div>
            <div className="text-xs text-brand-600 dark:text-brand-400 mt-1">{rec.reason}</div>
          </div>
        )}

        {driver.dimensions && (
          <div>
            <h4 className="text-sm font-medium mb-2">Dimensioner</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {Object.entries(driver.dimensions).filter(([_, v]) => v != null).map(([key, value]) => (
                <div key={key} className="bg-gray-50 dark:bg-gray-750 rounded p-2">
                  <div className="text-xs text-gray-500">{key}</div>
                  <div className="text-sm font-medium">{value} mm</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {driver.notes && (
          <div>
            <h4 className="text-sm font-medium mb-1">Noter</h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">{driver.notes}</p>
          </div>
        )}
      </div>
    </Card>
  )
}
