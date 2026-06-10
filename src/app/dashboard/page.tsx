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
  const { data: library } = await supabase
    .from('libraries')
    .select('id, name, total_seats, seat_label_prefix')
    .eq('owner_id', user.id)
    .maybeSingle()

  // Onboarding Server Action if Library doesn't exist
  async function createLibrary(formData: FormData) {
    'use server'
    const supabaseServer = await createClient()
    const { data: { user: authUser } } = await supabaseServer.auth.getUser()
    
    if (!authUser) redirect('/login')

    const name = formData.get('libraryName') as string
    const totalSeats = parseInt(formData.get('totalSeats') as string) || 50
    const prefix = formData.get('prefix') as string || 'G'

    // Insert new core library node
    const { data: insertedLibs, error: libError } = await supabaseServer
      .from('libraries')
      .insert([{ 
        name, 
        total_seats: totalSeats, 
        seat_label_prefix: prefix, 
        owner_id: authUser.id 
      }])
      .select()

    if (libError || !insertedLibs || insertedLibs.length === 0) {
      console.error('Critical deployment fault at library registration:', libError)
      return
    }

    const newLib = insertedLibs[0]

    // Concurrent relational insertions framework
    await supabaseServer.from('shifts').insert([
      { library_id: newLib.id, name: 'Morning', start_time: '07:00:00', end_time: '13:00:00', is_full_day: false, sort_order: 1 },
      { library_id: newLib.id, name: 'Evening', start_time: '13:00:00', end_time: '19:00:00', is_full_day: false, sort_order: 2 },
      { library_id: newLib.id, name: 'Night', start_time: '19:00:00', end_time: '07:00:00', is_full_day: false, sort_order: 3 }
    ])

    // LOOP FIXED: Generates pure sequential seat numbers (1 to totalSeats) without duplicate grouping
    const seatInserts = Array.from({ length: totalSeats }, (_, i) => ({
      library_id: newLib.id,
      seat_number: i + 1,
      status: 'vacant'
    }))
    
    await supabaseServer.from('seats').insert(seatInserts)

    // Complete purge of routers data lifecycle states
    revalidatePath('/', 'layout')
    revalidatePath('/dashboard', 'page')
    
    // Explicit dynamic pipeline redirect instructions
    redirect('/dashboard')
  }

  // Render Premium Onboarding Form UI if metadata row is missing
  if (!library) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="w-full max-w-md space-y-8 rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
          <div className="text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-gray-900">Setup Your Library Dashboard</h2>
            <p className="mt-2 text-xs text-gray-500">Enter your library configuration details below to deploy your control dashboard.</p>
          </div>
          
          <form action={createLibrary} className="mt-8 space-y-5">
            <div>
              <label htmlFor="libraryName" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Library Name
              </label>
              <input
                id="libraryName"
                name="libraryName"
                type="text"
                required
                placeholder="e.g., Kliks Library"
                className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="totalSeats" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Total Seats
                </label>
                <input
                  id="totalSeats"
                  name="totalSeats"
                  type="number"
                  min="1"
                  max="500"
                  required
                  placeholder="e.g., 50"
                  className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label htmlFor="prefix" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Seat Prefix
                </label>
                <input
                  id="prefix"
                  name="prefix"
                  type="text"
                  maxLength={3}
                  required
                  placeholder="e.g., G"
                  className="mt-1.5 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm placeholder-gray-400 text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all"
            >
              Initialize Control Center
            </button>
          </form>
        </div>
      </div>
    )
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
