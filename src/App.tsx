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

  useEffect(() => {
    // Seed initial drivers if database is empty
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
        <div className="text-gray-500">Indlæser...</div>
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
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <span className="text-xl font-bold text-brand-600">🔊 Speaker Design</span>
            </div>
            <nav className="flex gap-1">
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
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
