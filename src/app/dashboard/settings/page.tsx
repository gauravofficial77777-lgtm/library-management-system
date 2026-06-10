import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Library, Shift } from '@/types/database'
import LibrarySettingsForm from '@/components/settings/LibrarySettingsForm'
import ShiftManager from '@/components/settings/ShiftManager'

// Force dynamic execution to prevent stale caching during client demos
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'Settings — Library Management' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 1. Fetch library with defensive maybeSingle to prevent crash if row is temporarily missing
  let { data: library } = await supabase
    .from('libraries')
    .select('id, name, total_seats, seat_label_prefix')
    .eq('owner_id', user.id)
    .maybeSingle()

  // Silent fallback auto-creation if user somehow bypasses the main dashboard onboarding checks
  if (!library) {
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
      library = insertedLibs[0]
      
      await supabase.from('shifts').insert([
        { library_id: library.id, name: 'Morning', start_time: '07:00:00', end_time: '13:00:00', is_full_day: false, sort_order: 1 },
        { library_id: library.id, name: 'Evening', start_time: '13:00:00', end_time: '19:00:00', is_full_day: false, sort_order: 2 },
        { library_id: library.id, name: 'Night', start_time: '19:00:00', end_time: '07:00:00', is_full_day: false, sort_order: 3 }
      ])
    }
  }

  if (!library) return <div className="p-6 text-sm text-red-500">Critical Error: Initialization failed.</div>

  // 2. Fetch shifts connected to this library
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('library_id', library.id)
    .order('sort_order', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="border-b pb-2">
        <h1 className="text-lg font-bold text-gray-900">Library Settings</h1>
        <p className="text-[11px] text-gray-500">Configure seats, shifts, and preferences for {library.name}</p>
      </div>

      {/* Section 1: Seat & Name Configuration Form */}
      <LibrarySettingsForm library={library as Library} />

      {/* Section 2: Shift Management */}
      <ShiftManager libraryId={library.id} initialShifts={(shifts ?? []) as Shift[]} />
    </div>
  )
}
