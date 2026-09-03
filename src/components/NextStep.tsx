// Navigation footer for guiding users through the design workflow.
// Shows a "Næste" button linking to the next step in the pipeline.

import { useNavigate } from 'react-router-dom'

interface Props {
  to: string
  label: string
  description?: string
}

export function NextStep({ to, label, description }: Props) {
  const navigate = useNavigate()
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      {description && (
        <span className="text-xs text-gray-500 dark:text-gray-400 hidden sm:inline">
          {description}
        </span>
      )}
      <button
        onClick={() => navigate(to)}
        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
      >
        Næste: {label}
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </button>
    </div>
  )
}
