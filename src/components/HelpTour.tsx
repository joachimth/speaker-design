// Help / intro tour overlay
//
// A lightweight walkthrough that highlights key features of the app.
// Uses localStorage to remember if the user has seen it.

import { useState } from 'react'
import { useSettingsStore } from '@/store/settingsStore'

interface TourStep {
  title: string
  body: string
  icon: string
}

const STEPS: TourStep[] = [
  {
    icon: '🔊',
    title: 'Velkommen til Speaker Design',
    body: 'Et værktøj til at designe og simulere højttalere med rigtige målte frekvenskurver. Her er en hurtig rundvisning.',
  },
  {
    icon: '📋',
    title: 'Enhedsstyring',
    body: 'Tilføj og administrer højttalerenheder (woofer, mellemtone, diskant) med T/S-parametre og målte SPL-kurver. Du kan også importere REW målinger (.txt).',
  },
  {
    icon: '📦',
    title: 'Kabinet Designer',
    body: 'Beregn sealed, ported og transmission line kabinetter. Sammenlign alle tre typer side-ved-side. Se panelresonanser og anbefalinger.',
  },
  {
    icon: '🎚️',
    title: 'Delefilter Designer',
    body: 'Design passive deltefiltre (1.-4. ordens, BW, LR) med rigtige komponentvalg. Se fase og gruppetid.',
  },
  {
    icon: '📊',
    title: 'System Simulering',
    body: 'Saml alt: vælg enheder, delingsfrekvenser, forstærkning, polarity og delay. Se samlet frekvensgang, impedans, gruppetid og fase. Auto-tune og tidsjustering.',
  },
  {
    icon: '🔢',
    title: 'MiniDSP Export',
    body: 'Eksporter biquad-koefficienter til MiniDSP 2x4 eller 4x10 HD. Kopier direkte eller download som .txt/.json med Q23 hex til XML-redigering.',
  },
  {
    icon: '📐',
    title: 'Cabinet Match',
    body: 'Find de bedste enheder til et bestemt kabinet. Systemet scorer alle enheder på fysisk tilpasning og volumenmatch.',
  },
  {
    icon: '🔍',
    title: 'A/B Sammenligning',
    body: 'Sammenlign to gemte projekter på samme plot med differenskurve og metrikker.',
  },
  {
    icon: '⚙️',
    title: 'Indstillinger',
    body: 'Skift mellem metriske (mm) og imperiale (tommer) enheder i headeren. Brug 🖨️ Print / PDF til at gemme eller udskrive dit design.',
  },
]

export function HelpTour() {
  const [open, setOpen] = useState(() => {
    return !localStorage.getItem('speaker-design-tour-seen')
  })
  const [step, setStep] = useState(0)
  const { units, toggleUnits } = useSettingsStore()
  void units
  void toggleUnits

  if (!open) return null

  const current = STEPS[step]!
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  function close() {
    localStorage.setItem('speaker-design-tour-seen', '1')
    setOpen(false)
  }

  function next() {
    if (isLast) {
      close()
    } else {
      setStep((s) => s + 1)
    }
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step
                  ? 'bg-brand-500 w-6'
                  : i < step
                  ? 'bg-brand-300'
                  : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center space-y-3">
          <div className="text-4xl">{current.icon}</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{current.title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{current.body}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={close}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Spring over
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={prev}
                className="px-3 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Tilbage
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-1.5 text-sm rounded-md bg-brand-500 text-white hover:bg-brand-600 font-medium"
            >
              {isLast ? 'Kom igang' : 'Næste'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Button to manually re-open the tour. */
export function HelpTourButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center p-2 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        title="Hjælp / rundvisning"
        aria-label="Hjælp"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </button>
      {open && <HelpTourReopen onClose={() => setOpen(false)} />}
    </>
  )
}

function HelpTourReopen({ onClose }: { onClose: () => void }) {
  // Reopen by clearing localStorage and remounting HelpTour
  localStorage.removeItem('speaker-design-tour-seen')
  // Force remount by key change is complex in this context,
  // so we just render the tour directly here
  const [step, setStep] = useState(0)

  const current = STEPS[step]!
  const isFirst = step === 0
  const isLast = step === STEPS.length - 1

  function close() {
    localStorage.setItem('speaker-design-tour-seen', '1')
    onClose()
  }

  function next() {
    if (isLast) close()
    else setStep((s) => s + 1)
  }

  function prev() {
    setStep((s) => Math.max(0, s - 1))
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === step ? 'bg-brand-500 w-6' : i < step ? 'bg-brand-300' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={`Step ${i + 1}`}
            />
          ))}
        </div>
        <div className="text-center space-y-3">
          <div className="text-4xl">{current.icon}</div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{current.title}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{current.body}</p>
        </div>
        <div className="flex items-center justify-between pt-2">
          <button onClick={close} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Luk
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={prev}
                className="px-3 py-1.5 text-sm rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Tilbage
              </button>
            )}
            <button
              onClick={next}
              className="px-4 py-1.5 text-sm rounded-md bg-brand-500 text-white hover:bg-brand-600 font-medium"
            >
              {isLast ? 'Færdig' : 'Næste'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
