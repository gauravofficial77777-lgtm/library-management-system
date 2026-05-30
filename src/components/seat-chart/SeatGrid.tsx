'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Seat, Student, Shift } from '@/types/database'
import SeatCard from './SeatCard'
import SeatModal from './SeatModal'

interface SeatGridProps {
  initialSeats: Seat[]
  libraryId: string
  students: Student[]
  shifts: Shift[]
  seatLabelPrefix: string
}

export default function SeatGrid({
  initialSeats,
  libraryId,
  students,
  shifts,
  seatLabelPrefix,
}: SeatGridProps) {
  const [seats, setSeats] = useState<Seat[]>(initialSeats)
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // ── Classification helpers ──
  const classifySeats = (seatList: Seat[]) => {
    let fullyOccupied = 0
    let partiallyOccupied = 0
    let fullyVacant = 0
    let maintenance = 0

    for (const seat of seatList) {
      if (seat.status === 'maintenance') {
        maintenance++
        continue
      }

      const activeAllocations = (seat.allocations ?? []).filter((a) => a.is_active)
      const occupiedCount = activeAllocations.length

      if (occupiedCount === 0) {
        fullyVacant++
      } else {
        // Check if a full-day shift is active — counts as fully occupied
        const hasFullDay = activeAllocations.some((a) => a.shift?.is_full_day === true)
        if (hasFullDay || occupiedCount >= shifts.length) {
          fullyOccupied++
        } else {
          partiallyOccupied++
        }
      }
    }

    return {
      total: seatList.length,
      fullyOccupied,
      partiallyOccupied,
      fullyVacant,
      maintenance,
    }
  }

  const counts = classifySeats(seats)

  // ── Refetch all allocations for this library's seats ──
  const refetchAllocations = useCallback(async () => {
    const supabase = createClient()
    const seatIds = seats.map((s) => s.id)

    if (seatIds.length === 0) return

    const { data } = await supabase
      .from('seat_allocations')
      .select(
        '*, student:students(id, name, phone, preparation_field, fee_due_date), shift:shifts(id, name, is_full_day)'
      )
      .in('seat_id', seatIds)
      .eq('is_active', true)

    if (data) {
      setSeats((prev) =>
        prev.map((seat) => ({
          ...seat,
          allocations: data.filter((a) => a.seat_id === seat.id),
        }))
      )

      // Also update the selected seat if the modal is open
      setSelectedSeat((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          allocations: data.filter((a) => a.seat_id === prev.id),
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seats.map((s) => s.id).join(',')])

  // ── Realtime subscription on seat_allocations ──
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`seat-allocations-realtime-${libraryId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'seat_allocations',
        },
        () => {
          // Any insert, update, or delete on seat_allocations → refetch
          refetchAllocations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [libraryId, refetchAllocations])

  // ── Sync with server data on re-render ──
  useEffect(() => {
    setSeats(initialSeats)
  }, [initialSeats])

  // ── Seat click / modal ──
  const handleSeatClick = (seat: Seat) => {
    setSelectedSeat(seat)
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setSelectedSeat(null)
  }

  // ── Seat label builder ──
  const getSeatLabel = (seat: Seat): string => {
    return `${seatLabelPrefix}${seat.seat_number}`
  }

  return (
    <div>
      {/* Count banner */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <CountCard
          label="Total Seats"
          count={counts.total}
          color="bg-slate-100 text-slate-700"
        />
        <CountCard
          label="Fully Occupied"
          count={counts.fullyOccupied}
          color="bg-emerald-50 text-emerald-700"
        />
        <CountCard
          label="Partially Occupied"
          count={counts.partiallyOccupied}
          color="bg-amber-50 text-amber-700"
        />
        <CountCard
          label="Fully Vacant"
          count={counts.fullyVacant}
          color="bg-red-50 text-red-700"
        />
      </div>

      {/* Legend */}
      <div className="mb-5 flex flex-wrap items-center gap-4 text-sm text-gray-600">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-emerald-500" />
          Fully Occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-amber-500" />
          Partially Occupied
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          Fully Vacant
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-gray-500" />
          Maintenance
        </span>
      </div>

      {/* Seat grid */}
      {seats.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-gray-400">
          No seats found for this library.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
          {seats.map((seat) => (
            <SeatCard
              key={seat.id}
              seat={seat}
              shifts={shifts}
              seatLabel={getSeatLabel(seat)}
              onSeatClick={handleSeatClick}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <SeatModal
        seat={selectedSeat}
        seatLabel={selectedSeat ? getSeatLabel(selectedSeat) : ''}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        students={students}
        shifts={shifts}
        libraryId={libraryId}
      />
    </div>
  )
}

function CountCard({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className={`rounded-xl px-4 py-3 ${color}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-xs font-medium opacity-80">{label}</p>
    </div>
  )
}
