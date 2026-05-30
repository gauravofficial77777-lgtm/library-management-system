import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Library, Shift } from '@/types/database'
import LibrarySettingsForm from '@/components/settings/LibrarySettingsForm'
import ShiftManager from '@/components/settings/ShiftManager'

export const metadata = { title: 'Settings — Library Management' }

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: library } = await supabase
    .from('libraries')
    .select('id, name, total_seats, seat_label_prefix')
    .eq('owner_id', user.id)
    .single()

  if (!library) return <div>No library found.</div>

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

      {/* Section 1: Seat Configuration */}
      <LibrarySettingsForm library={library as Library} />

      {/* Section 2: Shift Management */}
      <ShiftManager libraryId={library.id} initialShifts={(shifts ?? []) as Shift[]} />
    </div>
  )
}
