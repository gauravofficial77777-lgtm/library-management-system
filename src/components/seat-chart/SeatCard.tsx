'use client'

import { Seat, Shift, SeatAllocation } from '@/types/database'

interface SeatCardProps {
  seat: Seat
  shifts: Shift[]
  seatLabel: string
  onSeatClick: (seat: Seat) => void
}

export default function SeatCard({ seat, shifts, seatLabel, onSeatClick }: SeatCardProps) {
  const allocations = seat.allocations ?? []

  // Determine if a full-day shift is actively allocated on this seat
  const fullDayAllocation = allocations.find(
    (a) => a.is_active && a.shift?.is_full_day === true
  )

  // Build per-shift status: 'occupied' | 'vacant' | 'blocked'
  const shiftStatuses = shifts.map((shift) => {
    const alloc = allocations.find(
      (a) => a.shift_id === shift.id && a.is_active
    )
    if (alloc) return 'occupied' as const

    // If a full-day shift is active on this seat and this ISN'T the full-day shift, it's blocked
    if (fullDayAllocation && !shift.is_full_day) return 'blocked' as const

    return 'vacant' as const
  })

  const occupiedCount = shiftStatuses.filter((s) => s === 'occupied').length
  const totalShifts = shifts.length

  // Find first student name from any active allocation
  const firstStudent = allocations.find((a) => a.is_active && a.student)?.student

  // ── Background color logic ──
  const getBgColor = (): string => {
    if (seat.status === 'maintenance') return 'bg-gray-500'
    if (totalShifts === 0 || occupiedCount === 0) return 'bg-red-500'
    if (occupiedCount === totalShifts) return 'bg-emerald-500'
    // Full-day shift blocks everything, treat as fully occupied
    if (fullDayAllocation) return 'bg-emerald-500'
    return 'bg-amber-500'
  }

  const getHoverBg = (): string => {
    if (seat.status === 'maintenance') return 'hover:bg-gray-600'
    if (totalShifts === 0 || occupiedCount === 0) return 'hover:bg-red-600'
    if (occupiedCount === totalShifts) return 'hover:bg-emerald-600'
    if (fullDayAllocation) return 'hover:bg-emerald-600'
    return 'hover:bg-amber-600'
  }

  // ── Dot color per shift status ──
  const dotColor = (status: 'occupied' | 'vacant' | 'blocked'): string => {
    switch (status) {
      case 'occupied':
        return 'bg-emerald-500'
      case 'blocked':
        return 'bg-gray-400'
      case 'vacant':
        return 'bg-red-400'
    }
  }

  return (
    <button
      onClick={() => onSeatClick(seat)}
      className={`
        ${getBgColor()} ${getHoverBg()}
        relative flex min-h-[110px] cursor-pointer flex-col items-center justify-center
        rounded-xl p-3 text-white shadow-md
        transition-all duration-200 hover:scale-105 hover:shadow-lg
        focus:ring-2 focus:ring-white/50 focus:outline-none
      `}
    >
      {/* Seat label */}
      <span className="text-2xl font-bold leading-none">{seatLabel}</span>

      {/* Student name (first allocated student) */}
      {firstStudent && (
        <span className="mt-1.5 w-full truncate text-center text-xs font-medium text-white/90">
          {firstStudent.name}
        </span>
      )}

      {/* Shift indicator dots */}
      {totalShifts > 0 && (
        <div className="mt-2 flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            {shiftStatuses.map((status, i) => (
              <span
                key={shifts[i].id}
                className={`inline-block h-2 w-2 rounded-full ${dotColor(status)} ring-1 ring-white/30`}
                title={`${shifts[i].name}: ${status}`}
              />
            ))}
          </div>
          {/* Shift initial labels */}
          <div className="flex items-center gap-1">
            {shifts.map((shift) => (
              <span
                key={shift.id}
                className="w-2 text-center text-[7px] font-medium leading-none text-white/60"
              >
                {shift.name.charAt(0).toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      )}
    </button>
  )
}
