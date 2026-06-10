'use client'

import { useState, useTransition } from 'react'
import { Library } from '@/types/database'
import { updateLibrarySettings } from '@/app/actions/settings'

interface LibrarySettingsFormProps {
  library: Library
}

export default function LibrarySettingsForm({ library }: LibrarySettingsFormProps) {
  const [libraryName, setLibraryName] = useState(library.name || 'My Library')
  const [totalSeats, setTotalSeats] = useState(library.total_seats)
  const [prefix, setPrefix] = useState(library.seat_label_prefix ?? 'G')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const previewCount = Math.min(totalSeats, 20)
  const previewLabels = Array.from({ length: previewCount }, (_, i) => `${prefix}${i + 1}`)
  const hasMore = totalSeats > previewCount

  function handleSave() {
    setError(null)
    setSuccess(false)
    startTransition(async () => {
      const result = await updateLibrarySettings(library.id, libraryName, totalSeats, prefix)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    })
  }

  const hasChanges =
    libraryName !== library.name ||
    totalSeats !== library.total_seats ||
    prefix !== (library.seat_label_prefix ?? 'G')

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-gray-900">Library Profile & Naming</h2>
        <p className="text-[10px] text-gray-500">Update your library identity, total layout seats, and naming prefixes</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          <span className="mr-1.5 font-semibold">Error:</span>{error}
        </div>
      )}

      {success && (
        <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
          <span className="mr-1.5 font-bold">✓</span> Library configurations and dashboard layout updated successfully.
        </div>
      )}

      <div className="space-y-4">
        {/* Full Width Library Name Input */}
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
            Library Name (Sidebar Display)
          </label>
          <input
            type="text"
            required
            value={libraryName}
            onChange={(e) => setLibraryName(e.target.value)}
            placeholder="e.g., Gaurav Library"
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Total Seats */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
              Total Seats
            </label>
            <input
              type="number"
              min={0}
              max={500}
              value={totalSeats}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val)) setTotalSeats(val)
              }}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-[10px] text-zinc-400">Min 0, Max 500</p>
          </div>

          {/* Seat Label Prefix */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
              Seat Label Prefix
            </label>
            <input
              type="text"
              maxLength={5}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="G"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <p className="mt-1 text-[10px] text-zinc-400">
              Appears before seat numbers (e.g. &quot;{prefix}1&quot;, &quot;{prefix}2&quot;)
            </p>
          </div>
        </div>
      </div>

      {/* Live Preview Strip */}
      {totalSeats > 0 && (
        <div className="mt-4">
          <label className="mb-1.5 block text-[10px] font-bold uppercase text-zinc-500 tracking-wider">
            Generated Layout Preview
          </label>
          <div className="flex flex-wrap gap-1.5 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
            {previewLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-700 shadow-sm"
              >
                {label}
              </td>
            ))}
            {hasMore && (
              <span className="inline-flex items-center justify-center px-2 py-1 text-[11px] text-zinc-400">
                … +{totalSeats - previewCount} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="mt-5 flex items-center justify-end gap-3 border-t pt-4">
        {hasChanges && !isPending && (
          <span className="text-[10px] text-amber-600 font-medium">You have unsaved adjustments</span>
        )}
        <button
          onClick={handleSave}
          disabled={isPending || !hasChanges}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Updating Control Panel…
            </span>
          ) : (
            'Save Configurations'
          )}
        </button>
      </div>
    </div>
  )
}
