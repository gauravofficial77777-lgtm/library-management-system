'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getSlotLabel } from '@/lib/utils'
import { markFeePaid, markFeeUnpaid } from '@/app/actions/students'

export default function FeesPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionPending, setActionPending] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: library } = await supabase
      .from('libraries')
      .select('id')
      .eq('owner_id', user.id)
      .single()

    if (library) {
      const { data: studentsData } = await supabase
        .from('students')
        .select('id, name, phone, seat_number, monthly_fee, fee_status, fee_due_date, current_slot')
        .eq('library_id', library.id)
        .order('name', { ascending: true })

      setStudents(studentsData ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Subscribe to realtime changes on students table for instant cross-tab sync
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('fees-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        () => {
          // Re-fetch on any student change (fee status, new admission, etc.)
          loadData()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadData])

  async function handleToggleFee(studentId: string, studentName: string, nextStatus: 'paid' | 'pending') {
    const msg = nextStatus === 'paid'
      ? `Mark fee as PAID for ${studentName}?`
      : `Revert status back to PENDING for ${studentName}?`

    if (!window.confirm(msg)) return

    setActionPending(studentId)
    try {
      const result = nextStatus === 'paid'
        ? await markFeePaid(studentId)
        : await markFeeUnpaid(studentId)

      if (result.error) {
        alert(`Error: ${result.error}`)
      } else {
        // Optimistic local update for instant UI response
        setStudents(prev =>
          prev.map(s =>
            s.id === studentId ? { ...s, fee_status: nextStatus } : s
          )
        )
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`)
    } finally {
      setActionPending(null)
    }
  }

  if (loading) return <div className="p-6 text-sm text-gray-500 animate-pulse">Loading Payments Ledger...</div>

  const filteredStudents = students.filter(s => {
    return s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
           (s.seat_number || '').toString().toLowerCase().includes(searchQuery.toLowerCase())
  })

  const pendingCount = students.filter(s => s.fee_status === 'pending' || !s.fee_status).length
  const paidCount = students.filter(s => s.fee_status === 'paid').length

  return (
    <div className="space-y-4">
      <div className="border-b pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Fees & Payments Ledger</h1>
          <p className="text-[11px] text-gray-500">Track customized monthly payments and seat allocations</p>
        </div>
        <div className="relative max-w-xs w-full">
          <input
            type="text"
            placeholder="Search custom seat or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-4 pr-3 py-1.5 rounded-lg border text-xs outline-none bg-white text-gray-900 focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-3 shadow-sm border-l-4 border-l-amber-500">
          <p className="text-[10px] font-semibold text-gray-400 uppercase">Pending Payments</p>
          <p className="text-xl font-bold text-amber-600">{pendingCount} Students</p>
        </div>
        <div className="rounded-lg border bg-white p-3 shadow-sm border-l-4 border-l-emerald-500">
          <p className="text-[10px] font-semibold text-gray-400 uppercase">Paid This Month</p>
          <p className="text-xl font-bold text-emerald-600">{paidCount} Students</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-500">
            <thead className="bg-slate-100 text-[10px] uppercase text-gray-700 font-bold border-b">
              <tr>
                <th className="px-4 py-3">Student Name</th>
                <th className="px-4 py-3">Seat No.</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Assigned Shift</th>
                <th className="px-4 py-3">Amount Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredStudents.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No student matched your search.</td></tr>
              ) : (
                filteredStudents.map((student) => {
                  const seatNo = student.seat_number ?? '—'
                  const isPaid = student.fee_status === 'paid'
                  const actualFee = student.monthly_fee !== undefined && student.monthly_fee !== null ? Number(student.monthly_fee) : 500
                  const isThisActionPending = actionPending === student.id

                  const message = `Hello ${student.name}, your library fee for Seat ${seatNo} is currently pending. Please pay ₹${actualFee}.`;
                  const whatsappUrl = `https://wa.me/91${student.phone}?text=${encodeURIComponent(message)}`;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition">
                      <td className={`px-4 py-3 font-semibold ${isPaid ? 'text-emerald-600' : 'text-gray-900'}`}>
                        {student.name}
                        {isPaid && <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded font-normal">Paid</span>}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border">{seatNo}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{student.phone}</td>
                      <td className="px-4 py-3 text-slate-500">{getSlotLabel(student.current_slot ?? 'morning')}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${isPaid ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                            {isPaid ? 'Paid' : 'Pending'}
                          </span>
                          <span className="text-[10px] font-bold text-zinc-700 pl-1 mt-0.5">
                            ₹{actualFee} {isPaid ? 'Received' : 'Due'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="bg-emerald-600 text-white text-[11px] px-2 py-1 rounded hover:bg-emerald-700">Remind</a>

                          {!isPaid ? (
                            <button
                              onClick={() => handleToggleFee(student.id, student.name, 'paid')}
                              disabled={isThisActionPending}
                              className="bg-white border text-slate-700 text-[11px] px-2.5 py-1 rounded font-semibold hover:text-emerald-600 disabled:opacity-50"
                            >
                              {isThisActionPending ? '...' : '✓ Clear'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleFee(student.id, student.name, 'pending')}
                              disabled={isThisActionPending}
                              className="bg-red-50 border border-red-200 text-red-600 text-[11px] px-2 py-1 rounded font-medium hover:bg-red-100 transition disabled:opacity-50"
                            >
                              {isThisActionPending ? '...' : '✕ Undo'}
                            </button>
                          )}
                        </div>
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
  )
}