// Shared UI components

import { type ReactNode } from 'react'

export function Card({ title, children, className = '' }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 ${className}`}>
      {title && (
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  disabled = false,
  className = '',
  id,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  className?: string
  id?: string
}) {
  const variants = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-300',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
    ghost: 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
  }
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      id={id}
      className={`rounded-md font-medium transition-colors disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Select({
  value,
  onChange,
  options,
  label,
  className = '',
}: {
  value: string | number
  onChange: (value: string) => void
  options: { value: string | number; label: string }[]
  label?: string
  className?: string
}) {
  return (
    <div className={className}>
      {label && <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function NumberInput({
  value,
  onChange,
  label,
  unit,
  step = 1,
  min,
  max,
  className = '',
}: {
  value: number
  onChange: (value: number) => void
  label?: string
  unit?: string
  step?: number
  min?: number
  max?: number
  className?: string
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          {label} {unit && <span className="text-gray-400">[{unit}]</span>}
        </label>
      )}
      <input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
      />
    </div>
  )
}

export function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-gray-50 dark:bg-gray-750 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {value} {unit && <span className="text-sm text-gray-500">{unit}</span>}
      </div>
    </div>
  )
}

export function Badge({ children, color = 'gray' }: { children: ReactNode; color?: 'gray' | 'green' | 'blue' | 'orange' | 'red' }) {
  const colors = {
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200',
    red: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[color]}`}>
      {children}
    </span>
  )
}
