'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── ALLOCATE A SHIFT ───────────────────────────────────────────────────────
// Assigns a student to a specific shift on a specific seat.
// Enforces the Full Day blocking rule:
//   - If the target shift is_full_day → no other shifts can have active allocations
//   - If another shift on this seat is_full_day and active → block this allocation
export async function allocateShift(
  seatId: string,
  shiftId: string,
  studentId: string,
  startDate?: string
) {
  const supabase = await createClient()

  // 1. Fetch the target shift's is_full_day flag
  const { data: targetShift, error: shiftErr } = await supabase
    .from('shifts')
    .select('id, is_full_day, library_id')
    .eq('id', shiftId)
    .single()

  if (shiftErr || !targetShift) {
    return { error: 'Shift not found.' }
  }

  // 2. Get all active allocations on this seat (with their shift details)
  const { data: existingAllocations } = await supabase
    .from('seat_allocations')
    .select('id, shift_id, shifts(id, is_full_day, name)')
    .eq('seat_id', seatId)
    .eq('is_active', true)

  const activeAllocs = existingAllocations ?? []

  // 3. Full Day blocking checks
  if (targetShift.is_full_day && activeAllocs.length > 0) {
    return {
      error: 'Cannot allocate a Full Day shift — other shifts on this seat are already occupied. Vacate them first.',
    }
  }

  const fullDayAlloc = activeAllocs.find(
    (a: any) => a.shifts?.is_full_day === true
  )
  if (fullDayAlloc && !targetShift.is_full_day) {
    const fullDayName = (fullDayAlloc as any).shifts?.name ?? 'Full Day'
    return {
      error: `This seat is blocked by the "${fullDayName}" shift. Vacate it first before allocating individual shifts.`,
    }
  }

  // 4. Check if this exact shift on this seat is already occupied
  const alreadyOccupied = activeAllocs.find((a: any) => a.shift_id === shiftId)
  if (alreadyOccupied) {
    return { error: 'This shift on this seat is already occupied.' }
  }

  // 5. Insert the allocation
  const { error: insertErr } = await supabase
    .from('seat_allocations')
    .insert({
      seat_id: seatId,
      shift_id: shiftId,
      student_id: studentId,
      start_date: startDate || new Date().toISOString().split('T')[0],
      is_active: true,
    })

  if (insertErr) {
    if (insertErr.code === '23505') {
      return { error: 'This shift on this seat is already occupied.' }
    }
    return { error: insertErr.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/seat-chart')
  revalidatePath('/dashboard/students')
  revalidatePath('/dashboard/fees')
  return { success: true }
}

// ─── VACATE A SHIFT ─────────────────────────────────────────────────────────
// Soft-deletes an allocation (sets is_active = false)
export async function vacateShift(allocationId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('seat_allocations')
    .update({ is_active: false })
    .eq('id', allocationId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/seat-chart')
  revalidatePath('/dashboard/students')
  revalidatePath('/dashboard/fees')
  return { success: true }
}

// ─── VACATE ALL SHIFTS ON A SEAT ────────────────────────────────────────────
export async function vacateAllShifts(seatId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('seat_allocations')
    .update({ is_active: false })
    .eq('seat_id', seatId)
    .eq('is_active', true)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/seat-chart')
  revalidatePath('/dashboard/students')
  revalidatePath('/dashboard/fees')
  return { success: true }
}
