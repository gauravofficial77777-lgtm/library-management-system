'use client'

import { useState, useTransition } from 'react'
import { Shift } from '@/types/database'
import { createShift, updateShift, deleteShift } from '@/app/actions/shifts'
import { formatTime } from '@/lib/utils'

interface ShiftManagerProps {
  libraryId: string
  initialShifts: Shift[]
}

interface ShiftFormData {
  name: string
  startTime: string
  endTime: string
  isFullDay: boolean
}

const emptyForm: ShiftFormData = {
  name: '',
  startTime: '07:00',
  endTime: '13:00',
  isFullDay: false,
}

export default function ShiftManager({ libraryId, initialShifts }: ShiftManagerProps) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState<ShiftFormData>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  function openAddForm() {
    setEditingId(null)
    setFormData(emptyForm)
    setShowAddForm(true)
    setError(null)
  }

  function openEditForm(shift: Shift) {
    setShowAddForm(false)
    setEditingId(shift.id)
    setFormData({
      name: shift.name,
      startTime: shift.start_time.slice(0, 5),
      endTime: shift.end_time.slice(0, 5),
      isFullDay: shift.is_full_day,
    })
    setError(null)
  }

  function cancelForm() {
    setShowAddForm(false)
    setEditingId(null)
    setFormData(emptyForm)
    setError(null)
  }

  function handleAdd() {
    if (!formData.name.trim()) {
      setError('Shift name is required.')
      return
    }
    setError(null)
    setPendingAction('add')
    startTransition(async () => {
      const result = await createShift(
        libraryId,
        formData.name,
        formData.startTime,
        formData.endTime,
        formData.isFullDay
      )
      if (result.error) {
        setError(result.error)
      } else {
        // Optimistic: append locally with a temp id; page will revalidate
        const newShift: Shift = {
          id: crypto.randomUUID(),
          library_id: libraryId,
          name: formData.name.trim(),
          start_time: formData.startTime,
          end_time: formData.endTime,
          is_full_day: formData.isFullDay,
          sort_order: shifts.length + 1,
          created_at: new Date().toISOString(),
        }
        setShifts((prev) => [...prev, newShift])
        setShowAddForm(false)
        setFormData(emptyForm)
      }
      setPendingAction(null)
    })
  }

  function handleUpdate() {
    if (!editingId) return
    if (!formData.name.trim()) {
      setError('Shift name is required.')
      return
    }
    setError(null)
    setPendingAction(`edit-${editingId}`)
    startTransition(async () => {
      const result = await updateShift(
        editingId,
        formData.name,
        formData.startTime,
        formData.endTime,
        formData.isFullDay
      )
      if (result.error) {
        setError(result.error)
      } else {
        setShifts((prev) =>
          prev.map((s) =>
            s.id === editingId
              ? {
                  ...s,
                  name: formData.name.trim(),
                  start_time: formData.startTime,
                  end_time: formData.endTime,
                  is_full_day: formData.isFullDay,
                }
              : s
          )
        )
        setEditingId(null)
        setFormData(emptyForm)
      }
      setPendingAction(null)
    })
  }

  function handleDelete(shiftId: string) {
    const shift = shifts.find((s) => s.id === shiftId)
    const confirmed = window.confirm(
      `Delete shift "${shift?.name ?? 'this shift'}"?\n\nIf there are active student allocations on this shift, deletion will be blocked.`
    )
    if (!confirmed) return

    setError(null)
    setPendingAction(`delete-${shiftId}`)
    startTransition(async () => {
      const result = await deleteShift(shiftId)
      if (result.error) {
        setError(result.error)
      } else {
        setShifts((prev) => prev.filter((s) => s.id !== shiftId))
        if (editingId === shiftId) {
          setEditingId(null)
          setFormData(emptyForm)
        }
      }
      setPendingAction(null)
    })
  }

  function renderForm(mode: 'add' | 'edit') {
    const isSaving =
      (mode === 'add' && pendingAction === 'add') ||
      (mode === 'edit' && pendingAction === `edit-${editingId}`)

    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4 space-y-3">
        <h3 className="text-xs font-bold text-gray-700">
          {mode === 'add' ? 'Add New Shift' : 'Edit Shift'}
        </h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Name */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              Shift Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Morning, Evening"
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Full Day Toggle */}
          <div className="flex items-end pb-1">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isFullDay}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, isFullDay: e.target.checked }))
                }
                className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-700">Full Day Shift</span>
            </label>
          </div>

          {/* Start Time */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              Start Time
            </label>
            <input
              type="time"
              value={formData.startTime}
              onChange={(e) => setFormData((f) => ({ ...f, startTime: e.target.value }))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* End Time */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">
              End Time
            </label>
            <input
              type="time"
              value={formData.endTime}
              onChange={(e) => setFormData((f) => ({ ...f, endTime: e.target.value }))}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-blue-200 pt-3">
          <button
            onClick={cancelForm}
            disabled={isSaving}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={mode === 'add' ? handleAdd : handleUpdate}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? (
              <span className="flex items-center gap-1.5">
                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            ) : mode === 'add' ? (
              'Add Shift'
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-gray-900">Shift Management</h2>
          <p className="text-[10px] text-gray-500">Define operating shifts for your library</p>
        </div>
        {!showAddForm && !editingId && (
          <button
            onClick={openAddForm}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-emerald-700"
          >
            + Add Shift
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          <span className="mr-1.5 font-semibold">Error:</span>{error}
        </div>
      )}

      {/* Shifts Table */}
      {shifts.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-zinc-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50">
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-zinc-500">Name</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-zinc-500">Start Time</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-zinc-500">End Time</th>
                <th className="px-4 py-2.5 text-[10px] font-bold uppercase text-zinc-500">Full Day?</th>
                <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50/50">
                  {editingId === shift.id ? (
                    <td colSpan={5} className="p-3">
                      {renderForm('edit')}
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-gray-900 text-xs">{shift.name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{formatTime(shift.start_time)}</td>
                      <td className="px-4 py-3 text-xs text-gray-600">{formatTime(shift.end_time)}</td>
                      <td className="px-4 py-3">
                        {shift.is_full_day ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 ring-1 ring-zinc-500/10">
                            No
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditForm(shift)}
                            disabled={isPending}
                            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-600 hover:border-blue-300 hover:text-blue-600 disabled:opacity-50"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(shift.id)}
                            disabled={isPending}
                            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-red-600 hover:border-red-300 hover:bg-red-50 disabled:opacity-50"
                          >
                            {pendingAction === `delete-${shift.id}` ? (
                              <span className="flex items-center gap-1">
                                <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                …
                              </span>
                            ) : (
                              'Delete'
                            )}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-center">
          <p className="text-xs text-zinc-500">No shifts configured yet. Add your first shift to get started.</p>
        </div>
      )}

      {/* Inline Add Form */}
      {showAddForm && <div className="mt-4">{renderForm('add')}</div>}
    </div>
  )
}
