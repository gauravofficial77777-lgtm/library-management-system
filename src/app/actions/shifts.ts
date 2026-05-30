'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── CREATE SHIFT ───────────────────────────────────────────────────────────
export async function createShift(
  libraryId: string,
  name: string,
  startTime: string,
  endTime: string,
  isFullDay: boolean
) {
  const supabase = await createClient()

  // Get current max sort_order for this library
  const { data: existing } = await supabase
    .from('shifts')
    .select('sort_order')
    .eq('library_id', libraryId)
    .order('sort_order', { ascending: false })
    .limit(1)

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 1

  const { error } = await supabase
    .from('shifts')
    .insert({
      library_id: libraryId,
      name: name.trim(),
      start_time: startTime,
      end_time: endTime,
      is_full_day: isFullDay,
      sort_order: nextOrder,
    })

  if (error) {
    if (error.code === '23505') {
      return { error: `A shift named "${name}" already exists in this library.` }
    }
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/seat-chart')
  return { success: true }
}

// ─── UPDATE SHIFT ───────────────────────────────────────────────────────────
export async function updateShift(
  shiftId: string,
  name: string,
  startTime: string,
  endTime: string,
  isFullDay: boolean
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('shifts')
    .update({
      name: name.trim(),
      start_time: startTime,
      end_time: endTime,
      is_full_day: isFullDay,
    })
    .eq('id', shiftId)

  if (error) {
    if (error.code === '23505') {
      return { error: `A shift named "${name}" already exists in this library.` }
    }
    return { error: error.message }
  }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/seat-chart')
  return { success: true }
}

// ─── DELETE SHIFT ───────────────────────────────────────────────────────────
export async function deleteShift(shiftId: string) {
  const supabase = await createClient()

  // Check for active allocations using this shift
  const { count } = await supabase
    .from('seat_allocations')
    .select('id', { count: 'exact', head: true })
    .eq('shift_id', shiftId)
    .eq('is_active', true)

  if (count && count > 0) {
    return {
      error: `Cannot delete this shift — ${count} active student allocation(s) are using it. Vacate them first.`,
    }
  }

  const { error } = await supabase
    .from('shifts')
    .delete()
    .eq('id', shiftId)

  if (error) return { error: error.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/seat-chart')
  return { success: true }
}
