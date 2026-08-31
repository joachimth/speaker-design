import { Routes, Route, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import DriverManager from './pages/DriverManager'
import CabinetDesigner from './pages/CabinetDesigner'
import CrossoverDesigner from './pages/CrossoverDesigner'
import SimulationView from './pages/SimulationView'
import SystemSimulation from './pages/SystemSimulation'
import ProjectOverview from './pages/ProjectOverview'
import CabinetMatch from './pages/CabinetMatch'
import { useDriverStore } from './store/driverStore'
import { SEED_DRIVERS } from './data/seedDrivers'
import { db } from './db/database'

export default function App() {
  const { loadDrivers } = useDriverStore()
  const [seeded, setSeeded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.theme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    async function init() {
      const count = await db.drivers.count()
      if (count === 0) {
        for (const driver of SEED_DRIVERS) {
          await db.drivers.put(driver)
        }
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
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <span className="text-lg sm:text-xl font-bold text-brand-600 whitespace-nowrap">🔊 Speaker Design</span>

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
        </Routes>
      </main>
    </div>
  )
}
