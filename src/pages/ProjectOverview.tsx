import { useEffect, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDriverStore } from '@/store/driverStore'
import { useProjectStore, downloadJSON, importJSONFile } from '@/store/projectStore'
import { Card, Badge, StatCard, Button } from '@/components/common/UI'
import { recommendCabinetType } from '@/lib/acoustic/thieleSmall'
import { baffleStepFrequency } from '@/lib/acoustic/baffle'
import type { DesignState } from '@/types'

export default function ProjectOverview() {
  const { drivers } = useDriverStore()
  const navigate = useNavigate()
  const { projects, loadProjects, deleteProject, setLoadedDesign } = useProjectStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Load a saved project into SystemSimulation
  function handleLoadProject(designState: DesignState) {
    setLoadedDesign(designState)
    navigate('/system')
  }

  // Export a saved project as JSON
  function handleExportProject(project: typeof projects[number]) {
    if (project.designState) {
      downloadJSON(project.designState, `${project.name.replace(/\s+/g, '-').toLowerCase()}.json`)
    }
  }

  // Delete a saved project
  async function handleDeleteProject(id: string) {
    await deleteProject(id)
  }

  // Import a JSON file as a design state and load it
  async function handleImportJSON(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await importJSONFile(file) as DesignState
      setLoadedDesign(data)
      navigate('/system')
    } catch (err) {
      console.error('Import failed:', err)
      alert('Kunne ikke importere fil. Tjek at det er en gyldig projekt-JSON.')
    }
    // Reset input so the same file can be imported again
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const woofer = drivers.find((d) => d.type === 'woofer' || d.type === 'subwoofer')
  const midrange = drivers.find((d) => d.type === 'midrange')
  const tweeter = drivers.find((d) => d.type === 'tweeter')

  const rec = woofer?.tsParams?.qts ? recommendCabinetType(woofer.tsParams) : null
  const fStep = baffleStepFrequency(320)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Projektoversigt</h2>
        <p className="text-sm text-gray-500 mt-1">
          Automatisk speaker design værktøj. Upload datablade, design kabinet, simuler respons.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Enheder i database" value={drivers.length} />
        <StatCard label="Woofers" value={drivers.filter((d) => d.type === 'woofer' || d.type === 'subwoofer').length} />
        <StatCard label="Midranges" value={drivers.filter((d) => d.type === 'midrange').length} />
        <StatCard label="Tweeters" value={drivers.filter((d) => d.type === 'tweeter').length} />
      </div>

      {/* Current system */}
      <Card title="Nuværende system (auto-valgt)">
        <div className="space-y-3">
          {drivers.length === 0 ? (
            <p className="text-sm text-gray-500">Ingen enheder. Gå til Enheder for at uploade datablade.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {woofer && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                  <Badge color="orange">Woofer</Badge>
                  <div className="mt-2 font-medium text-sm text-gray-900 dark:text-gray-100">{woofer.manufacturer} {woofer.model}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Fs {woofer.tsParams?.fs}Hz · Qts {woofer.tsParams?.qts} · Vas {woofer.tsParams?.vas}L
                  </div>
                </div>
              )}
              {midrange && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                  <Badge color="green">Midrange</Badge>
                  <div className="mt-2 font-medium text-sm text-gray-900 dark:text-gray-100">{midrange.manufacturer} {midrange.model}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Fs {midrange.tsParams?.fs}Hz · Qts {midrange.tsParams?.qts}
                  </div>
                </div>
              )}
              {tweeter && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-3">
                  <Badge color="blue">Tweeter</Badge>
                  <div className="mt-2 font-medium text-sm text-gray-900 dark:text-gray-100">{tweeter.manufacturer} {tweeter.model}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Fs {tweeter.tsParams?.fs}Hz · Sens {tweeter.tsParams?.sensitivity}dB
                  </div>
                </div>
              )}
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
        </div>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card title="Næste skridt">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-brand-500">1.</span>
              <span>Upload flere datablade under <strong>Enheder</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand-500">2.</span>
              <span>Vælg kabinettype under <strong>Kabinet</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand-500">3.</span>
              <span>Opsæt delingsfilter under <strong>Delingsfilter</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-brand-500">4.</span>
              <span>Se simulering under <strong>Simulering</strong></span>
            </div>
          </div>
        </Card>

        <Card title="Baffelstep reference">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">320×1080mm baffel:</span>
              <span className="font-medium">{fStep.toFixed(0)} Hz</span>
            </div>
            <div className="text-xs text-gray-500">
              Baffelsteppet sker når bølgelængden bliver mindre end bafflen.
              Tab: op til 6 dB ved lave frekvenser. Kan kompenseres med DSP.
            </div>
          </div>
        </Card>
      </div>

      {/* Project management */}
      <Card title="Mine projekter">
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => navigate('/system')} variant="primary" size="sm">
              + Nytt design (System Sim.)
            </Button>
            <Button onClick={() => fileInputRef.current?.click()} variant="secondary" size="sm">
              📤 Importer JSON
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportJSON}
              className="hidden"
            />
          </div>

          {projects.length === 0 ? (
            <p className="text-sm text-gray-500">
              Ingen gemte projekter endnu. Design et system under System Simulering og tryk Gem.
            </p>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between border border-gray-200 dark:border-gray-700 rounded-md p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                      {project.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {new Date(project.createdAt).toLocaleDateString('da-DK')} · {project.designState?.ways || '?'}-vejs
                      {project.designState?.bands && ` · ${project.designState.bands.filter((b) => b.driverId).length} enheder`}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    {project.designState && (
                      <Button
                        onClick={() => handleLoadProject(project.designState!)}
                        variant="primary"
                        size="sm"
                      >
                        Indlæs
                      </Button>
                    )}
                    {project.designState && (
                      <Button
                        onClick={() => handleExportProject(project)}
                        variant="ghost"
                        size="sm"
                      >
                        Eksporter
                      </Button>
                    )}
                    <Button
                      onClick={() => handleDeleteProject(project.id)}
                      variant="danger"
                      size="sm"
                    >
                      Slet
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
