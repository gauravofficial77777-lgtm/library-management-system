'use client'

import { useState, useTransition, useMemo } from 'react'
import { Student } from '@/types/database'
import { deleteStudent } from '@/app/actions/students'
import { generateWhatsAppLink, formatDate } from '@/lib/utils'
import StudentFormModal from './StudentFormModal'

interface StudentTableProps {
  students: Student[]
  libraryId: string
  studentSeatMap: Record<string, number>
}

export default function StudentTable({
  students,
  libraryId,
  studentSeatMap,
}: StudentTableProps) {
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filtered = useMemo(() => {
    if (!search.trim()) return students
    const q = search.toLowerCase()
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) || s.phone.includes(q)
    )
  }, [students, search])

  function isOverdue(date: string | null): boolean {
    if (!date) return false
    return new Date(date) < new Date()
  }

  function handleEdit(student: Student) {
    setEditingStudent(student)
    setIsModalOpen(true)
  }

  function handleAdd() {
    setEditingStudent(null)
    setIsModalOpen(true)
  }

  function handleDelete(studentId: string) {
    if (!confirm('Are you sure you want to delete this student? This will also vacate their seat.')) {
      return
    }
    setDeletingId(studentId)
    startTransition(async () => {
      await deleteStudent(studentId)
      setDeletingId(null)
    })
  }

  function handleWhatsApp(student: Student) {
    const link = generateWhatsAppLink(student.phone, student.name, student.fee_due_date)
    window.open(link, '_blank')
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-xs">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-10 pr-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-blue-400"
          />
        </div>

        {/* Add button */}
        <button
          onClick={handleAdd}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Student
        </button>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 py-16 dark:border-zinc-700">
          <svg
            className="mb-4 h-12 w-12 text-zinc-300 dark:text-zinc-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
            />
          </svg>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {search ? 'No students match your search' : 'No students yet'}
          </p>
          {!search && (
            <button
              onClick={handleAdd}
              className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              + Add your first student
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400">
                    Name
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400">
                    Phone
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400 sm:table-cell">
                    Preparation
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400 md:table-cell">
                    Fee Due
                  </th>
                  <th className="hidden whitespace-nowrap px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400 md:table-cell">
                    Seat #
                  </th>
                  <th className="whitespace-nowrap px-4 py-3 text-right font-semibold text-zinc-600 dark:text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filtered.map((student) => {
                  const overdue = isOverdue(student.fee_due_date)
                  const seatNum = studentSeatMap[student.id]
                  return (
                    <tr
                      key={student.id}
                      className={`transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${
                        overdue
                          ? 'bg-red-50/60 hover:bg-red-50 dark:bg-red-950/30 dark:hover:bg-red-950/40'
                          : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100">
                          {student.name}
                        </div>
                        {/* Mobile-only sub-info */}
                        <div className="mt-0.5 text-xs text-zinc-500 sm:hidden dark:text-zinc-400">
                          {student.preparation_field}
                          {overdue && (
                            <span className="ml-2 text-red-600 dark:text-red-400">
                              • Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-zinc-600 dark:text-zinc-400">
                        {student.phone}
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3.5 sm:table-cell">
                        <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                          {student.preparation_field}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3.5 md:table-cell">
                        <span
                          className={
                            overdue
                              ? 'font-medium text-red-600 dark:text-red-400'
                              : 'text-zinc-600 dark:text-zinc-400'
                          }
                        >
                          {formatDate(student.fee_due_date)}
                          {overdue && (
                            <span className="ml-1.5 inline-flex rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-red-700 dark:bg-red-900 dark:text-red-300">
                              Overdue
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-4 py-3.5 text-zinc-600 dark:text-zinc-400 md:table-cell">
                        {student.seat_number ? (
                          <span className="inline-flex items-center justify-center rounded-lg bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {student.seat_number}
                          </span>
                        ) : seatNum ? (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {seatNum}
                          </span>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          {/* WhatsApp */}
                          <button
                            onClick={() => handleWhatsApp(student)}
                            title="Send WhatsApp"
                            className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950"
                          >
                            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                            </svg>
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleEdit(student)}
                            title="Edit student"
                            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                            </svg>
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDelete(student.id)}
                            disabled={isPending && deletingId === student.id}
                            title="Delete student"
                            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-red-950 dark:hover:text-red-400"
                          >
                            {isPending && deletingId === student.id ? (
                              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                            ) : (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      <StudentFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingStudent(null)
        }}
        libraryId={libraryId}
        student={editingStudent}
      />
    </>
  )
}
