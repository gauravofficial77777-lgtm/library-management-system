import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Seat, Student, Shift, SeatAllocation } from '@/types/database'
import SeatGrid from '@/components/seat-chart/SeatGrid'
import { getCurrentSlot, getSlotLabel } from '@/lib/utils'

export const metadata = {
  title: 'Dashboard — Library Management',
}

export default async function DashboardPage() {
  const supabase = await createClient()

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
          <p className="mt-1 text-sm text-gray-500">
            Your account is not associated with any library.
          </p>
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
  
  // 100% Fixed TypeScript Bypass using unknown conversion
  const allocations: SeatAllocation[] = (allocationsData ?? []) as unknown as SeatAllocation[]

  // Map allocations onto seats
  const seats: Seat[] = (seatsData ?? []).map((s: any) => ({
    ...s,
    allocations: allocations.filter((a) => a.seat_id === s.id),
  }))

  // 6-Box metrics
  const totalSeatsCount = seats.length
  const occupiedCount = seats.filter((s) => (s.allocations && s.allocations.length > 0)).length
  const totalSlots = seats.length * shifts.length
  const totalActiveAllocations = allocations.length
  const availableSlotsCount = totalSlots - totalActiveAllocations
  const feePendingCount = students.filter((st) => st.fee_status === 'pending' || !st.fee_status).length
  const feePaidCount = students.filter((st) => st.fee_status === 'paid').length
  const overallStudentsCount = students.length

  const currentSlot = getCurrentSlot()

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-row items-center justify-between border-b pb-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Dashboard Overview</h1>
          <p className="text-[11px] text-gray-500">Live control center for {library.name}</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-[11px]">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-medium text-emerald-700">
            Active Shift: {getSlotLabel(currentSlot)}
          </span>
        </div>
      </div>

      {/* 6 Grid Boxes Row - Single Compact Row */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Box 1: Total Seats */}
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Seats</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{totalSeatsCount}</p>
        </div>

        {/* Box 2: Occupied */}
        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Occupied Seats</p>
            <span className="text-[9px] bg-red-50 text-red-600 px-1 rounded font-medium">View</span>
          </div>
          <p className="mt-1 text-xl font-bold text-red-600">{occupiedCount}</p>
        </div>

        {/* Box 3: Available Slots */}
        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Available Slots</p>
            <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 rounded font-medium">Map</span>
          </div>
          <p className="mt-1 text-xl font-bold text-emerald-600">{availableSlotsCount}</p>
        </div>

        {/* Box 4: Fee Pending */}
        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Fee Pending</p>
            <span className="text-[9px] bg-amber-50 text-amber-600 px-1 rounded font-medium">Alert</span>
          </div>
          <p className="mt-1 text-xl font-bold text-amber-500">{feePendingCount}</p>
        </div>

        {/* Box 5: Fee Complete */}
        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Fee Complete</p>
            <span className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded font-medium">List</span>
          </div>
          <p className="mt-1 text-xl font-bold text-blue-600">{feePaidCount}</p>
        </div>

        {/* Box 6: Overall Students */}
        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Overall Joined</p>
            <span className="text-[9px] bg-purple-50 text-purple-600 px-1 rounded font-medium">History</span>
          </div>
          <p className="mt-1 text-xl font-bold text-purple-600">{overallStudentsCount}</p>
        </div>
      </div>

      {/* Live Seat Map Area */}
      <div className="mt-4 rounded-xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-xs font-bold text-gray-800 uppercase tracking-wider">Live Seat Map</h2>
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
