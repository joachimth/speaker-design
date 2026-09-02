import { Routes, Route, NavLink } from 'react-router-dom'
import { useEffect, useState, lazy, Suspense } from 'react'
import DriverManager from './pages/DriverManager'
import CabinetDesigner from './pages/CabinetDesigner'
import CrossoverDesigner from './pages/CrossoverDesigner'
import SimulationView from './pages/SimulationView'
import SystemSimulation from './pages/SystemSimulation'
import ProjectOverview from './pages/ProjectOverview'
import CabinetMatch from './pages/CabinetMatch'
import DesignCompare from './pages/DesignCompare'
const WaveguideDesigner = lazy(() => import('./components/WaveguideDesigner').then(m => ({ default: m.WaveguideDesigner })))
import { useDriverStore } from './store/driverStore'
import { useDesignStore } from '@/store/designStore';
import { useSettingsStore } from '@/store/settingsStore';
import { HelpTour, HelpTourButton } from '@/components/HelpTour';
import { SEED_DRIVERS } from './data/seedDrivers'
import { db } from './db/database'

export default function App() {
  const { loadDrivers } = useDriverStore()
  const { projectName, isDirty, design } = useDesignStore()
  const { ways, bands } = design
  const { units, toggleUnits } = useSettingsStore()
  const [seeded, setSeeded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.theme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    async function init() {
      // Upsert all seed drivers so new additions appear even if DB already has older data
      for (const driver of SEED_DRIVERS) {
        await db.drivers.put(driver)
      }
      setSeeded(true)
      await loadDrivers()
    }
    init()
  }, [loadDrivers])

  if (!seeded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Indlæser…</div>
      </div>
    )
  }

  const navItems = [
    { to: '/', label: 'Overblik' },
    { to: '/drivers', label: 'Enheder' },
    { to: '/cabinet', label: 'Kabinet' },
    { to: '/match', label: 'Kabinet Match' },
    { to: '/crossover', label: 'Delingsfilter' },
    { to: '/simulation', label: 'Simulering' },
    { to: '/system', label: 'System Sim.' },
    { to: '/compare', label: 'A/B Sammenlign' },
    { to: '/waveguide', label: 'Waveguide' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <span className="text-lg sm:text-xl font-bold text-brand-600 whitespace-nowrap">🔊 Speaker Design</span>

            {/* Active design indicator */}
            <span className="hidden md:inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 ml-2">
              <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
                {projectName || 'Ikke navngivet'}
              </span>
              <span className="text-gray-400">·</span>
              <span>{ways}-vejs</span>
              <span className="text-gray-400">·</span>
              <span>{bands.filter((b) => b.driverId).length} enheder</span>
              {isDirty && (
                <span className="inline-block w-2 h-2 rounded-full bg-amber-500" title="Ikke gemt" />
              )}
            </span>

            {/* Desktop nav */}
            <nav className="hidden sm:flex gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="flex items-center gap-1">
              {/* Unit system toggle */}
              <button
                className="flex items-center px-2 py-1.5 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={toggleUnits}
                title={units === 'metric' ? 'Skift til imperial (tommer)' : 'Skift til metrisk (mm)'}
              >
                {units === 'metric' ? 'mm' : 'in'}
              </button>

              {/* Help / tour */}
              <HelpTourButton />

              {/* Dark mode toggle */}
              <button
                className="flex items-center p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={() => setDark(!dark)}
                aria-label={dark ? 'Skift til lyst tema' : 'Skift til mørkt tema'}
                title={dark ? 'Lyst tema' : 'Mørkt tema'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {dark ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                    />
                  )}
                </svg>
              </button>

              {/* Mobile hamburger */}
              <button
              className="sm:hidden flex items-center p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile dropdown menu */}
          {menuOpen && (
            <nav className="sm:hidden pb-3 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Routes>
          <Route path="/" element={<ProjectOverview />} />
          <Route path="/drivers" element={<DriverManager />} />
          <Route path="/cabinet" element={<CabinetDesigner />} />
          <Route path="/match" element={<CabinetMatch />} />
          <Route path="/crossover" element={<CrossoverDesigner />} />
          <Route path="/simulation" element={<SimulationView />} />
          <Route path="/system" element={<SystemSimulation />} />
          <Route path="/compare" element={<DesignCompare />} />
          <Route path="/waveguide" element={<Suspense fallback={<div className="p-8 text-center text-gray-500">Indlæser waveguide designer...</div>}><WaveguideDesigner /></Suspense>} />
        </Routes>
      </main>

      {/* Intro tour overlay (shows on first visit) */}
      <HelpTour />
    </div>
  )
}
