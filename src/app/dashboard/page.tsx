import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { Seat, Student, Shift, SeatAllocation } from '@/types/database'
import SeatGrid from '@/components/seat-chart/SeatGrid'
import { getCurrentSlot, getSlotLabel } from '@/lib/utils'

// FORCE DYNAMIC CONFIG TO KILL NEXT.JS LOCAL CACHE LOOPS PERMANENTLY
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = {
  title: 'Dashboard — Library Management',
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // 1. Fetch library structural metadata live
  const { data: fetchedLibrary } = await supabase
    .from('libraries')
    .select('id, name, total_seats, seat_label_prefix')
    .eq('owner_id', user.id)
    .maybeSingle()

  // SILENT AUTO-ONBOARDING: If no library exists, create a default configuration on the fly
  if (!fetchedLibrary) {
    const { data: insertedLibs } = await supabase
      .from('libraries')
      .insert([{ 
        name: 'My Library', 
        total_seats: 0, 
        seat_label_prefix: 'G', 
        owner_id: user.id 
      }])
      .select()

    if (insertedLibs && insertedLibs.length > 0) {
      const newLib = insertedLibs[0]
      
      // Relational insertion of default shifts in background using guaranteed newLib constant
      await supabase.from('shifts').insert([
        { library_id: newLib.id, name: 'Morning', start_time: '07:00:00', end_time: '13:00:00', is_full_day: false, sort_order: 1 },
        { library_id: newLib.id, name: 'Evening', start_time: '13:00:00', end_time: '19:00:00', is_full_day: false, sort_order: 2 },
        { library_id: newLib.id, name: 'Night', start_time: '19:00:00', end_time: '07:00:00', is_full_day: false, sort_order: 3 }
      ])
      
      revalidatePath('/', 'layout')
    }
    // Redirect first-time unconfigured user straight to settings page
    redirect('/dashboard/settings')
  }

  // TypeScript now 100% guarantees 'library' is not null from this point downwards
  const library = fetchedLibrary

  // If library is newly auto-created with 0 seats, push them to settings to initialize configuration
  if (library.total_seats === 0) {
    redirect('/dashboard/settings')
  }

  // 2. Continuous real-time stream synchronization
  const { data: seatsData } = await supabase
    .from('seats')
    .select('id, seat_number, library_id, status, updated_at')
    .eq('library_id', library.id)
    .order('seat_number', { ascending: true })

  const { data: studentsData } = await supabase
    .from('students')
    .select('id, name, phone, seat_number, monthly_fee, fee_status, fee_due_date, current_slot, preparation_field, library_id, seat_id, joining_date')
    .eq('library_id', library.id)
    .order('name', { ascending: true })

  const { data: shiftsData } = await supabase
    .from('shifts')
    .select('id, library_id, name, start_time, end_time, is_full_day, sort_order')
    .eq('library_id', library.id)
    .order('sort_order', { ascending: true })

  const { data: allocationsData } = await supabase
    .from('seat_allocations')
    .select('id, seat_id, shift_id, student_id, is_active, student:students(id, name, phone, preparation_field, fee_due_date), shift:shifts(id, name, is_full_day)')
    .eq('is_active', true)

  const students: Student[] = (studentsData ?? []) as Student[]
  const shifts: Shift[] = (shiftsData ?? []) as Shift[]
  const allocations: SeatAllocation[] = (allocationsData ?? []) as unknown as SeatAllocation[]

  const seats: Seat[] = (seatsData ?? []).map((s: any) => ({
    ...s,
    allocations: allocations.filter((a) => a.seat_id === s.id),
  }))

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

      {/* Metrics Allocation Block Grid */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Total Seats</p>
          <p className="mt-1 text-xl font-bold text-gray-900">{totalSeatsCount}</p>
        </div>

        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Occupied Seats</p>
            <span className="text-[9px] bg-red-50 text-red-600 px-1 rounded font-medium">View</span>
          </div>
          <p className="mt-1 text-xl font-bold text-red-600">{occupiedCount}</p>
        </div>

        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Available Slots</p>
            <span className="text-[9px] bg-emerald-50 text-emerald-600 px-1 rounded font-medium">Map</span>
          </div>
          <p className="mt-1 text-xl font-bold text-emerald-600">{availableSlotsCount}</p>
        </div>

        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Fee Pending</p>
            <span className="text-[9px] bg-amber-50 text-amber-600 px-1 rounded font-medium">Alert</span>
          </div>
          <p className="mt-1 text-xl font-bold text-amber-500">{feePendingCount}</p>
        </div>

        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Fee Complete</p>
            <span className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded font-medium">List</span>
          </div>
          <p className="mt-1 text-xl font-bold text-blue-600">{feePaidCount}</p>
        </div>

        <div className="cursor-pointer rounded-xl border bg-white p-3 shadow-sm hover:bg-slate-50 transition">
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider truncate">Overall Joined</p>
            <span className="text-[9px] bg-purple-50 text-purple-600 px-1 rounded font-medium">History</span>
          </div>
          <p className="mt-1 text-xl font-bold text-purple-600">{overallStudentsCount}</p>
        </div>
      </div>

      {/* Synchronized SeatMap Display */}
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
