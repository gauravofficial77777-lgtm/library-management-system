import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getCurrentSlot, getSlotLabel } from '@/lib/utils'
import DashboardSidebar from '@/components/dashboard/DashboardSidebar'

export const metadata = {
  title: 'Dashboard — Library Management',
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get library for the logged-in owner
  const { data: library } = await supabase
    .from('libraries')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  const libraryName = library?.name ?? 'My Library'
  const currentSlot = getCurrentSlot()
  const slotLabel = getSlotLabel(currentSlot)

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <DashboardSidebar
        libraryName={libraryName}
        currentSlot={currentSlot}
        slotLabel={slotLabel}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
