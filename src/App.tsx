import { Routes, Route, NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import DriverManager from './pages/DriverManager'
import CabinetDesigner from './pages/CabinetDesigner'
import CrossoverDesigner from './pages/CrossoverDesigner'
import SimulationView from './pages/SimulationView'
import ProjectOverview from './pages/ProjectOverview'
import { useDriverStore } from './store/driverStore'
import { SEED_DRIVERS } from './data/seedDrivers'
import { db } from './db/database'

export default function App() {
  const { loadDrivers } = useDriverStore()
  const [seeded, setSeeded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

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
        <div className="text-gray-500">Indlaeser...</div>
      </div>
    )
  }

  const navItems = [
    { to: '/', label: 'Overblik' },
    { to: '/drivers', label: 'Enheder' },
    { to: '/cabinet', label: 'Kabinet' },
    { to: '/crossover', label: 'Delingsfilter' },
    { to: '/simulation', label: 'Simulering' },
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
          <Route path="/crossover" element={<CrossoverDesigner />} />
          <Route path="/simulation" element={<SimulationView />} />
        </Routes>
      </main>
    </div>
  )
}
