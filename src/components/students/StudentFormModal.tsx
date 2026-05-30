'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { Student } from '@/types/database'
import { createStudent, updateStudent } from '@/app/actions/students'

const PREPARATION_FIELDS = ['UPSC', 'SSC', 'NEET', 'JEE', 'GATE', 'Banking', 'Railway', 'State PSC', 'General'] as const
const SLOT_OPTIONS = [
  { value: 'morning', label: 'Morning Shift (7 AM – 1 PM)' },
  { value: 'afternoon', label: 'Afternoon Shift (1 PM – 6 PM)' },
  { value: 'evening', label: 'Evening Shift (6 PM – 11 PM)' },
  { value: 'full', label: 'Full Day (7 AM – 11 PM)' },
]

interface StudentFormModalProps {
  isOpen: boolean
  onClose: () => void
  libraryId: string
  student?: Student | null
}

export default function StudentFormModal({ isOpen, onClose, libraryId, student }: StudentFormModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const isEdit = !!student

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (isOpen) {
      setError(null)
      setTimeout(() => nameRef.current?.focus(), 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  function handleSubmit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      let result: { error?: string; success?: boolean }
      if (isEdit && student) {
        result = await updateStudent(student.id, formData)
      } else {
        formData.set('library_id', libraryId)
        result = await createStudent(formData)
      }
      
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {isEdit ? 'Modify Registration' : 'New Admission Form'}
          </h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        {error && <div className="mb-4 rounded-lg bg-red-50 p-2.5 text-xs text-red-700">{error}</div>}

        <form action={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          <input type="hidden" name="library_id" value={libraryId} />

          <div>
            <label className="mb-1 block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Student Name *</label>
            <input ref={nameRef} name="name" type="text" required defaultValue={student?.name ?? ''} placeholder="Full name" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 dark:text-gray-900 outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Contact Number *</label>
            <input name="phone" type="text" required maxLength={10} defaultValue={student?.phone ?? ''} placeholder="10-digit number" className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 dark:text-gray-900 outline-none focus:border-blue-500" />
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Shift Timing *</label>
            <select name="current_slot" required defaultValue={student?.current_slot ?? 'morning'} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 dark:text-gray-900 outline-none focus:border-blue-500">
              {SLOT_OPTIONS.map(s => <option key={s.value} value={s.value} className="text-gray-900">{s.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Alphanumeric Seat</label>
              <input name="seat_number" type="text" placeholder="Ex: S4, M5, 12" defaultValue={student?.seat_number ?? ''} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 dark:text-gray-900 outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Custom Fee Rate (₹)</label>
              <input name="monthly_fee" type="number" placeholder="Ex: 600" defaultValue={student?.monthly_fee ?? 500} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 dark:text-gray-900 outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Preparation Field</label>
              <select name="preparation_field" defaultValue={student?.preparation_field ?? 'General'} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 dark:text-gray-900 outline-none focus:border-blue-500">
                {PREPARATION_FIELDS.map(f => <option key={f} value={f} className="text-gray-900">{f}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase">Day of Joining</label>
              <input name="joining_date" type="date" defaultValue={student?.joining_date ?? todayStr} className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-gray-900 dark:text-gray-900 outline-none focus:border-blue-500" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <button type="button" onClick={onClose} className="rounded-lg border px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300">Cancel</button>
            <button type="submit" disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">{isPending ? 'Saving...' : 'Confirm'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}