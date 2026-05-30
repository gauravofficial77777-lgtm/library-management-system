'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── CREATE STUDENT ─────────────────────────────────────────────────────────
export async function createStudent(formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const current_slot = formData.get('current_slot') as string
  const library_id = formData.get('library_id') as string
  const seat_number = (formData.get('seat_number') as string) || null
  const monthly_fee = parseInt(formData.get('monthly_fee') as string, 10) || 500
  const preparation_field = (formData.get('preparation_field') as string) || 'General'

  // Compute joining_date and auto-calculate fee_due_date (1 month ahead)
  const joining_date_raw = formData.get('joining_date') as string
  const joining_date = joining_date_raw || new Date().toISOString().split('T')[0]
  const dueDateObj = new Date(joining_date)
  dueDateObj.setMonth(dueDateObj.getMonth() + 1)
  const fee_due_date = dueDateObj.toISOString().split('T')[0]

  try {
    const { error } = await supabase
      .from('students')
      .insert([
        {
          name,
          phone,
          current_slot,
          library_id,
          seat_number,
          monthly_fee,
          joining_date,
          fee_due_date,
          fee_status: 'pending',
          preparation_field,
        },
      ])

    if (error) throw error

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/students')
    revalidatePath('/dashboard/fees')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to save student data.' }
  }
}

// ─── UPDATE STUDENT ─────────────────────────────────────────────────────────
export async function updateStudent(id: string, formData: FormData) {
  const supabase = await createClient()

  const name = formData.get('name') as string
  const phone = formData.get('phone') as string
  const current_slot = formData.get('current_slot') as string
  const seat_number = (formData.get('seat_number') as string) || null
  const monthly_fee = parseInt(formData.get('monthly_fee') as string, 10) || 500
  const preparation_field = (formData.get('preparation_field') as string) || 'General'

  const updatePayload: Record<string, any> = {
    name,
    phone,
    current_slot,
    seat_number,
    monthly_fee,
    preparation_field,
  }

  const joining_date = formData.get('joining_date') as string
  if (joining_date) {
    updatePayload.joining_date = joining_date
    const dueDateObj = new Date(joining_date)
    dueDateObj.setMonth(dueDateObj.getMonth() + 1)
    updatePayload.fee_due_date = dueDateObj.toISOString().split('T')[0]
  }

  try {
    const { error } = await supabase
      .from('students')
      .update(updatePayload)
      .eq('id', id)

    if (error) throw error

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/students')
    revalidatePath('/dashboard/fees')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to update student.' }
  }
}

// ─── DELETE STUDENT ─────────────────────────────────────────────────────────
export async function deleteStudent(id: string) {
  const supabase = await createClient()

  try {
    // 1. Deactivate all seat_allocations for this student
    await supabase
      .from('seat_allocations')
      .update({ is_active: false })
      .eq('student_id', id)
      .eq('is_active', true)

    // 2. Clear any legacy seat assignment
    await supabase
      .from('seats')
      .update({
        status: 'vacant' as const,
        current_student_id: null,
        current_slot: null,
      })
      .eq('current_student_id', id)

    // 3. Delete the student
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', id)

    if (error) throw error

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/students')
    revalidatePath('/dashboard/fees')
    revalidatePath('/dashboard/seat-chart')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to delete student.' }
  }
}

// ─── MARK FEE PAID ──────────────────────────────────────────────────────────
export async function markFeePaid(studentId: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('students')
      .update({ fee_status: 'paid' })
      .eq('id', studentId)

    if (error) throw error

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/fees')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to mark fee as paid.' }
  }
}

// ─── MARK FEE PENDING (UNDO) ───────────────────────────────────────────────
export async function markFeeUnpaid(studentId: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('students')
      .update({ fee_status: 'pending' })
      .eq('id', studentId)

    if (error) throw error

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/fees')
    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Failed to revert fee status.' }
  }
}