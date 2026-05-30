import { createAdminClient } from '@/lib/supabase/admin'

// Color mapping for preparation fields
const FIELD_COLORS: Record<string, { bg: string; bar: string; text: string }> = {
  UPSC: { bg: 'bg-violet-950/40', bar: 'bg-violet-500', text: 'text-violet-300' },
  SSC: { bg: 'bg-blue-950/40', bar: 'bg-blue-500', text: 'text-blue-300' },
  NEET: { bg: 'bg-emerald-950/40', bar: 'bg-emerald-500', text: 'text-emerald-300' },
  JEE: { bg: 'bg-amber-950/40', bar: 'bg-amber-500', text: 'text-amber-300' },
  GATE: { bg: 'bg-cyan-950/40', bar: 'bg-cyan-500', text: 'text-cyan-300' },
  Banking: { bg: 'bg-rose-950/40', bar: 'bg-rose-500', text: 'text-rose-300' },
  Railway: { bg: 'bg-orange-950/40', bar: 'bg-orange-500', text: 'text-orange-300' },
  'State PSC': { bg: 'bg-teal-950/40', bar: 'bg-teal-500', text: 'text-teal-300' },
  General: { bg: 'bg-zinc-800/60', bar: 'bg-zinc-500', text: 'text-zinc-300' },
}

function getFieldColor(field: string) {
  return (
    FIELD_COLORS[field] ?? {
      bg: 'bg-zinc-800/60',
      bar: 'bg-zinc-500',
      text: 'text-zinc-300',
    }
  )
}

interface LibrarySummary {
  id: string
  name: string
  total_seats: number
  occupied_seats: number
  total_students: number
}

interface StudentRow {
  id: string
  name: string
  phone: string
  preparation_field: string
  library_name: string
}

export default async function AdminPage() {
  const supabase = createAdminClient()

  // Parallel fetch all data — optimized: explicit columns instead of wildcards
  const [librariesRes, studentsRes, seatsRes] = await Promise.all([
    supabase.from('libraries').select('id, name, total_seats'),
    supabase.from('students').select('id, name, phone, preparation_field, library_id, libraries(name)'),
    supabase.from('seats').select('id, library_id, status'),
  ])

  if (librariesRes.error || studentsRes.error || seatsRes.error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-xl border border-red-800 bg-red-950 p-8 text-center">
          <p className="text-red-300">
            Failed to load admin data:{' '}
            {librariesRes.error?.message ||
              studentsRes.error?.message ||
              seatsRes.error?.message}
          </p>
        </div>
      </div>
    )
  }

  const libraries = librariesRes.data ?? []
  const students = studentsRes.data ?? []
  const seats = seatsRes.data ?? []

  // Compute stats
  const totalLibraries = libraries.length
  const totalStudents = students.length
  const totalSeats = seats.length
  const occupiedSeats = seats.filter((s) => s.status === 'occupied').length

  // Group by preparation field
  const prepFieldCounts: Record<string, number> = {}
  for (const s of students) {
    const field = s.preparation_field || 'General'
    prepFieldCounts[field] = (prepFieldCounts[field] || 0) + 1
  }
  const maxFieldCount = Math.max(...Object.values(prepFieldCounts), 1)

  // Per-library summary
  const libSummaries: LibrarySummary[] = libraries.map((lib) => {
    const libSeats = seats.filter((s) => s.library_id === lib.id)
    return {
      id: lib.id,
      name: lib.name,
      total_seats: libSeats.length,
      occupied_seats: libSeats.filter((s) => s.status === 'occupied').length,
      total_students: students.filter((s) => s.library_id === lib.id).length,
    }
  })

  // Full student table - Fixed Bracket Syntax Issue Here
  const studentRows: StudentRow[] = students.map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
    preparation_field: s.preparation_field || 'General',
    library_name: (Array.isArray(s.libraries) ? s.libraries[0] : (s.libraries as any))?.name ?? 'Unknown'
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Stat Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Libraries"
          value={totalLibraries}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21" />
            </svg>
          }
          color="blue"
        />
        <StatCard
          label="Total Students"
          value={totalStudents}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
          color="emerald"
        />
        <StatCard
          label="Total Seats"
          value={totalSeats}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          }
          color="violet"
        />
        <StatCard
          label="Occupied Seats"
          value={occupiedSeats}
          icon={
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
          color="amber"
        />
      </div>

      {/* Preparation Field Breakdown */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">
          Students by Preparation Field
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(prepFieldCounts)
            .sort(([, a], [, b]) => b - a)
            .map(([field, count]) => {
              const colors = getFieldColor(field)
              const percentage = Math.round((count / maxFieldCount) * 100)
              return (
                <div
                  key={field}
                  className={`rounded-xl border border-zinc-800 ${colors.bg} p-4`}
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span
                      className={`text-sm font-semibold ${colors.text}`}
                    >
                      {field}
                    </span>
                    <span className="text-xl font-bold text-zinc-100">
                      {count}
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full rounded-full ${colors.bar} transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
        </div>
      </div>

      {/* Per-Library Summary */}
      <div className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">
          Library Overview
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/80">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-400">
                    Library Name
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-semibold text-zinc-400">
                    Total Seats
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-semibold text-zinc-400">
                    Occupied
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-semibold text-zinc-400">
                    Occupancy
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-center font-semibold text-zinc-400">
                    Students
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {libSummaries.map((lib) => {
                  const occupancy =
                    lib.total_seats > 0
                      ? Math.round(
                          (lib.occupied_seats / lib.total_seats) * 100
                        )
                      : 0
                  return (
                    <tr
                      key={lib.id}
                      className="transition-colors hover:bg-zinc-800/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-100">
                        {lib.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-zinc-400">
                        {lib.total_seats}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-zinc-400">
                        {lib.occupied_seats}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center">
                        <div className="mx-auto flex w-24 items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-800">
                            <div
                              className={`h-full rounded-full transition-all ${
                                occupancy > 80
                                  ? 'bg-red-500'
                                  : occupancy > 50
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                              }`}
                              style={{ width: `${occupancy}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400">
                            {occupancy}%
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-center text-zinc-400">
                        {lib.total_students}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Full Student Table */}
      <div>
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">
          All Students
          <span className="ml-2 text-sm font-normal text-zinc-500">
            ({studentRows.length})
          </span>
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-400">
                    Name
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-400">
                    Phone
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-semibold text-zinc-400 sm:table-cell">
                    Preparation
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-semibold text-zinc-400 md:table-cell">
                    Library
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {studentRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-12 text-center text-zinc-500"
                    >
                      No students found across any library.
                    </td>
                  </tr>
                ) : (
                  studentRows.map((s) => {
                    const colors = getFieldColor(s.preparation_field)
                    return (
                      <tr
                        key={s.id}
                        className="transition-colors hover:bg-zinc-800/50"
                      >
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-zinc-100">
                          {s.name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-zinc-400">
                          {s.phone}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 sm:table-cell">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg} ${colors.text} border border-zinc-700/50`}
                          >
                            {s.preparation_field}
                          </span>
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 text-zinc-400 md:table-cell">
                          {s.library_name}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Stat Card ───────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string
  value: number
  icon: React.ReactNode
  color: 'blue' | 'emerald' | 'violet' | 'amber'
}) {
  const colorMap = {
    blue: 'from-blue-600/20 to-blue-600/5 border-blue-800/50 text-blue-400',
    emerald:
      'from-emerald-600/20 to-emerald-600/5 border-emerald-800/50 text-emerald-400',
    violet:
      'from-violet-600/20 to-violet-600/5 border-violet-800/50 text-violet-400',
    amber:
      'from-amber-600/20 to-amber-600/5 border-amber-800/50 text-amber-400',
  }

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br p-5 ${colorMap[color]}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-zinc-400">{label}</span>
        {icon}
      </div>
      <p className="text-3xl font-bold text-zinc-100">{value}</p>
    </div>
  )
}
