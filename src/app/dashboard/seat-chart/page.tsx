import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Seat, Student, Shift, SeatAllocation } from '@/types/database'
import SeatGrid from '@/components/seat-chart/SeatGrid'
import { getCurrentSlot, getSlotLabel } from '@/lib/utils'

export const metadata = {
  title: 'Seat Chart — Library Management',
}

export default async function SeatChartPage() {
  const supabase = await createClient()

  // Check login
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 1. Library config
  const { data: library } = await supabase
    .from('libraries')
    .select('id, name, total_seats, seat_label_prefix')
    .eq('owner_id', user.id)
    .single()

  if (!library) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900">No Library Found</h2>
        </div>
      </div>
    )
  }

  // 2. Seats
  const { data: seatsData } = await supabase
    .from('seats')
    .select('id, seat_number, library_id, status, updated_at')
    .eq('library_id', library.id)
    .order('seat_number', { ascending: true })

  // 3. Students
  const { data: studentsData } = await supabase
    .from('students')
    .select('id, name, phone, seat_number, monthly_fee, fee_status, fee_due_date, current_slot, preparation_field, library_id, seat_id, joining_date')
    .eq('library_id', library.id)
    .order('name', { ascending: true })

  // 4. Shifts
  const { data: shiftsData } = await supabase
    .from('shifts')
    .select('id, library_id, name, start_time, end_time, is_full_day, sort_order')
    .eq('library_id', library.id)
    .order('sort_order', { ascending: true })

  // 5. Active allocations with joined student and shift data
  const { data: allocationsData } = await supabase
    .from('seat_allocations')
    .select('id, seat_id, shift_id, student_id, is_active, student:students(id, name, phone, preparation_field, fee_due_date), shift:shifts(id, name, is_full_day)')
    .eq('is_active', true)

  const students: Student[] = (studentsData ?? []) as Student[]
  const shifts: Shift[] = (shiftsData ?? []) as Shift[]
  const allocations: SeatAllocation[] = (allocationsData ?? []) as SeatAllocation[]

  // Map allocations onto seats
  const seats: Seat[] = (seatsData ?? []).map((s: any) => ({
    ...s,
    allocations: allocations.filter((a) => a.seat_id === s.id),
  }))

  const currentSlot = getCurrentSlot()

  return (
    <div className="space-y-4">
      <div className="flex flex-row items-center justify-between border-b pb-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Live Seat Chart</h1>
          <p className="text-[11px] text-gray-500">Manage slots and interactive 2D layout for {library.name}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-[11px]">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-slate-700">
            {getSlotLabel(currentSlot)}
          </span>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <SeatGrid
          initialSeats={seats}
          libraryId={library.id}
          students={students}
          shifts={shifts}
          seatLabelPrefix={library.seat_label_prefix || ''}
        />
      </div>
    </div>
  )
}