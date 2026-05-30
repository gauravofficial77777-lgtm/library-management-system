'use client'

import { useState, useTransition } from 'react'
import { Seat, Student, Shift, SeatAllocation } from '@/types/database'
import { formatShiftTimeRange, formatDate } from '@/lib/utils'
import { allocateShift, vacateShift } from '@/app/actions/allocations'

interface SeatModalProps {
  seat: Seat | null
  seatLabel: string
  isOpen: boolean
  onClose: () => void
  students: Student[]
  shifts: Shift[]
  libraryId: string
}

export default function SeatModal({
  seat,
  seatLabel,
  isOpen,
  onClose,
  students,
  shifts,
  libraryId,
}: SeatModalProps) {
  const [activeTabId, setActiveTabId] = useState<string>(shifts[0]?.id ?? '')
  const [selectedStudent, setSelectedStudent] = useState('')
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !seat) return null

  const allocations = seat.allocations ?? []

  // Determine if a full-day shift is actively allocated on this seat
  const fullDayAllocation = allocations.find(
    (a) => a.is_active && a.shift?.is_full_day === true
  )

  // Get allocation for the currently active tab
  const activeShift = shifts.find((s) => s.id === activeTabId)
  const activeAllocation = allocations.find(
    (a) => a.shift_id === activeTabId && a.is_active
  )

  // Is this tab blocked by a full-day shift?
  const isBlocked =
    fullDayAllocation &&
    activeShift &&
    !activeShift.is_full_day &&
    fullDayAllocation.shift_id !== activeTabId

  // Students already allocated to any shift on this seat
  const allocatedStudentIds = new Set(
    allocations.filter((a) => a.is_active).map((a) => a.student_id)
  )

  // Available students: not already allocated to a shift on this seat
  const availableStudents = students.filter(
    (s) => !allocatedStudentIds.has(s.id)
  )

  // ── Overall seat status label ──
  const occupiedShiftCount = allocations.filter((a) => a.is_active).length
  const overallStatus =
    seat.status === 'maintenance'
      ? 'Maintenance'
      : occupiedShiftCount === 0
        ? 'Fully Vacant'
        : occupiedShiftCount >= shifts.length || fullDayAllocation
          ? 'Fully Occupied'
          : 'Partially Occupied'

  const overallStatusColor =
    seat.status === 'maintenance'
      ? 'bg-gray-100 text-gray-700'
      : occupiedShiftCount === 0
        ? 'bg-red-100 text-red-700'
        : occupiedShiftCount >= shifts.length || fullDayAllocation
          ? 'bg-emerald-100 text-emerald-700'
          : 'bg-amber-100 text-amber-700'

  const headerBg =
    seat.status === 'maintenance'
      ? 'bg-gray-500'
      : occupiedShiftCount === 0
        ? 'bg-red-500'
        : occupiedShiftCount >= shifts.length || fullDayAllocation
          ? 'bg-emerald-500'
          : 'bg-amber-500'

  // ── Tab border color based on shift status ──
  const getTabBorderColor = (shiftId: string): string => {
    const alloc = allocations.find((a) => a.shift_id === shiftId && a.is_active)
    if (alloc) return 'border-emerald-500'
    const shift = shifts.find((s) => s.id === shiftId)
    if (fullDayAllocation && shift && !shift.is_full_day) return 'border-gray-400'
    return 'border-red-400'
  }

  // ── Handlers ──
  const handleVacate = (allocationId: string) => {
    setError(null)
    startTransition(async () => {
      const result = await vacateShift(allocationId)
      if (result.error) {
        setError(result.error)
      } else {
        onClose()
      }
    })
  }

  const handleAllocate = () => {
    if (!selectedStudent) {
      setError('Please select a student')
      return
    }
    if (!activeTabId) {
      setError('No shift selected')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await allocateShift(seat.id, activeTabId, selectedStudent)
      if (result.error) {
        setError(result.error)
      } else {
        setSelectedStudent('')
        onClose()
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="animate-in fade-in zoom-in-95 relative w-full max-w-lg rounded-2xl bg-white shadow-2xl duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold text-white ${headerBg}`}
            >
              {seatLabel}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Seat {seatLabel}
              </h2>
              <span
                className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${overallStatusColor}`}
              >
                {overallStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="mx-6 mb-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Maintenance state */}
        {seat.status === 'maintenance' ? (
          <div className="px-6 pb-6">
            <div className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">
              This seat is currently under maintenance.
            </div>
          </div>
        ) : (
          <>
            {/* Dynamic shift tabs */}
            <div className="border-b border-gray-200 px-6">
              <div className="-mb-px flex gap-1 overflow-x-auto">
                {shifts.map((shift) => {
                  const isActive = shift.id === activeTabId
                  return (
                    <button
                      key={shift.id}
                      onClick={() => {
                        setActiveTabId(shift.id)
                        setError(null)
                        setSelectedStudent('')
                      }}
                      className={`
                        flex-shrink-0 border-b-2 px-3 py-2.5 text-xs font-medium transition-colors
                        ${
                          isActive
                            ? `${getTabBorderColor(shift.id)} text-gray-900`
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }
                      `}
                    >
                      <span className="block">{shift.name}</span>
                      <span className="block text-[10px] opacity-70">
                        {formatShiftTimeRange(shift.start_time, shift.end_time)}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tab content */}
            <div className="p-6">
              {activeShift && isBlocked ? (
                /* ── Blocked by Full Day shift ── */
                <div className="rounded-xl bg-gray-50 p-5 text-center">
                  <div className="mb-2 text-2xl text-gray-300">🔒</div>
                  <p className="text-sm font-medium text-gray-500">
                    Blocked by &ldquo;{fullDayAllocation?.shift?.name ?? 'Full Day'}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Vacate the full-day shift to allocate individual shifts.
                  </p>
                </div>
              ) : activeAllocation ? (
                /* ── Occupied: show student details ── */
                <div className="space-y-4">
                  <div className="space-y-3 rounded-xl bg-gray-50 p-4">
                    <InfoRow
                      label="Student"
                      value={activeAllocation.student?.name ?? 'Unknown'}
                    />
                    <InfoRow
                      label="Phone"
                      value={activeAllocation.student?.phone ?? 'N/A'}
                    />
                    <InfoRow
                      label="Preparation"
                      value={activeAllocation.student?.preparation_field ?? 'N/A'}
                    />
                    <InfoRow
                      label="Fee Due"
                      value={formatDate(activeAllocation.student?.fee_due_date ?? null)}
                    />
                    <InfoRow
                      label="Start Date"
                      value={formatDate(activeAllocation.start_date)}
                    />
                  </div>

                  <button
                    onClick={() => handleVacate(activeAllocation.id)}
                    disabled={isPending}
                    className="w-full cursor-pointer rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
                  >
                    {isPending ? 'Vacating...' : 'Vacate Shift'}
                  </button>
                </div>
              ) : (
                /* ── Vacant: allocation form ── */
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">
                      Select Student
                    </label>
                    <select
                      value={selectedStudent}
                      onChange={(e) => setSelectedStudent(e.target.value)}
                      className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 transition-colors focus:border-slate-500 focus:ring-2 focus:ring-slate-500/20 focus:outline-none"
                    >
                      <option value="">Choose a student...</option>
                      {availableStudents.map((student) => (
                        <option key={student.id} value={student.id}>
                          {student.name} — {student.phone}
                        </option>
                      ))}
                    </select>
                    {availableStudents.length === 0 && (
                      <p className="mt-1.5 text-xs text-gray-500">
                        No available students to assign.
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleAllocate}
                    disabled={isPending || !selectedStudent}
                    className="w-full cursor-pointer rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isPending ? 'Allocating...' : 'Allocate Student'}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  )
}
