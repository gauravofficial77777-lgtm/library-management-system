import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Student } from '@/types/database'
import StudentTable from '@/components/students/StudentTable'

export const metadata = {
  title: 'Students | LibraryOS',
}

export default async function StudentsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Fetch the user's library
  const { data: library, error: libError } = await supabase
    .from('libraries')
    .select('id, name')
    .eq('owner_id', user.id)
    .single()

  if (libError || !library) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950">
          <p className="text-red-700 dark:text-red-300">
            Library not found. Please contact support.
          </p>
        </div>
      </div>
    )
  }

  // Fetch all students for this library with their seat info
  const { data: students, error: studentsError } = await supabase
    .from('students')
    .select('id, name, phone, seat_number, monthly_fee, fee_status, fee_due_date, current_slot, preparation_field, library_id, seat_id, joining_date, joined_date, created_at')
    .eq('library_id', library.id)
    .order('created_at', { ascending: false })

  if (studentsError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950">
          <p className="text-red-700 dark:text-red-300">
            Failed to load students: {studentsError.message}
          </p>
        </div>
      </div>
    )
  }

  // Fetch seats to map student → seat number
  const { data: seats } = await supabase
    .from('seats')
    .select('seat_number, current_student_id')
    .eq('library_id', library.id)
    .not('current_student_id', 'is', null)

  const studentSeatMap: Record<string, number> = {}
  if (seats) {
    for (const seat of seats) {
      if (seat.current_student_id) {
        studentSeatMap[seat.current_student_id] = seat.seat_number
      }
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Students
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {(students as Student[])?.length ?? 0} total students in{' '}
            <span className="font-medium text-gray-700">
              {library.name}
            </span>
          </p>
        </div>
      </div>

      {/* Client component handles table + modals */}
      <StudentTable
        students={(students as Student[]) ?? []}
        libraryId={library.id}
        studentSeatMap={studentSeatMap}
      />
    </>
  )
}
