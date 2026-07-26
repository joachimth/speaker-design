// Parameter set selector — switch between named T/S parameter sets on a driver.
// Allows comparing datasheet vs DATS-measured values in real time.
//
// Usage: embed in any component that consumes driver.tsParams. Pass a callback
// that updates the active parameter set (typically by setting driver.tsParams).

import { useMemo } from 'react';
import type { Driver, ThieleSmallParams } from '@/types';

interface Props {
  driver: Driver;
  /** Called when user picks a parameter set — parent should update tsParams */
  onSelect: (params: ThieleSmallParams, setName: string) => void;
}

interface SetEntry {
  name: string;
  params: ThieleSmallParams;
  notes: string;
}

/**
 * Compare two T/S param sets by their key identifiers (fs + qts).
 * Returns true if they match within floating point tolerance.
 */
function paramsMatch(a: ThieleSmallParams, b: ThieleSmallParams): boolean {
  const fsDiff = Math.abs(a.fs - b.fs) / Math.max(a.fs, 1);
  const qtsDiff = Math.abs(a.qts - b.qts) / Math.max(a.qts, 0.01);
  return fsDiff < 0.001 && qtsDiff < 0.001;
}

export default function ParameterSetSelector({ driver, onSelect }: Props) {
  // Build the list of choices: [Datasheet] + [each parameterSet]
  const entries: SetEntry[] = useMemo(() => {
    const result: SetEntry[] = [
      {
        name: 'Datablad',
        params: driver.tsParams,
        notes: 'Producentens officielle datablad værdier',
      },
    ];
    for (const set of driver.parameterSets ?? []) {
      result.push({
        name: set.name,
        params: set.tsParams,
        notes: set.notes ?? '',
      });
    }
    return result;
  }, [driver.tsParams, driver.parameterSets]);

  // Determine which entry is currently active
  const activeName: string = useMemo(() => {
    for (const e of entries) {
      if (paramsMatch(e.params, driver.tsParams)) return e.name;
    }
    return 'Datablad';
  }, [entries, driver.tsParams]);

  // Don't render if only the default option exists
  if ((driver.parameterSets?.length ?? 0) === 0) return null;

  return (
    <div className="mb-4">
      <h4 className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
        Parameter sæt
        <span className="text-xs text-gray-400 ml-2 font-normal">
          Skift mellem datablad og målte værdier
        </span>
      </h4>
      <div className="flex flex-wrap gap-2">
        {entries.map((entry) => {
          const active = entry.name === activeName;
          return (
            <button
              key={entry.name}
              type="button"
              onClick={() => onSelect(entry.params, entry.name)}
              title={entry.notes}
              className={`
                inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md border transition-colors
                ${active
                  ? 'bg-brand-600 text-white border-brand-600 dark:bg-brand-500 dark:border-brand-500'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
                }
              `}
            >
              {entry.name}
              {entry.notes && !active && (
                <span className="ml-1.5 opacity-60" title={entry.notes}>ⓘ</span>
              )}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-gray-400 mt-1">
        Valgt: <strong>{activeName}</strong>
        {activeName !== 'Datablad' && (
          <span className="ml-1">
            — {entries.find(e => e.name === activeName)?.notes}
          </span>
        )}
      </p>
    </div>
  );
}
