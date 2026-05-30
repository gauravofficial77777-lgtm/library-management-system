'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ─── UPDATE SEAT COUNT & PREFIX ─────────────────────────────────────────────
// Dynamically add or remove seats for a library.
// On decrease: hard-delete only if seats are unoccupied across all shifts.
export async function updateSeatCount(
  libraryId: string,
  newTotal: number,
  prefix?: string
) {
  const supabase = await createClient()

  if (newTotal < 1 || newTotal > 500) {
    return { error: 'Total seats must be between 1 and 500.' }
  }

  // Get current seat count
  const { data: currentSeats, error: fetchErr } = await supabase
    .from('seats')
    .select('id, seat_number')
    .eq('library_id', libraryId)
    .order('seat_number', { ascending: true })

  if (fetchErr) return { error: fetchErr.message }

  const currentCount = currentSeats?.length ?? 0

  if (newTotal > currentCount) {
    // ── INCREASE: create additional seats ──
    const newSeats = []
    for (let i = currentCount + 1; i <= newTotal; i++) {
      newSeats.push({
        seat_number: i,
        library_id: libraryId,
        status: 'vacant' as const,
      })
    }
    const { error: insertErr } = await supabase
      .from('seats')
      .insert(newSeats)

    if (insertErr) return { error: insertErr.message }
  } else if (newTotal < currentCount) {
    // ── DECREASE: remove only unoccupied seats from the end ──
    const seatsToRemove = currentSeats!
      .slice(newTotal)
      .map((s) => s.id)

    // Check if any of these seats have active allocations
    const { count: occupiedCount } = await supabase
      .from('seat_allocations')
      .select('id', { count: 'exact', head: true })
      .in('seat_id', seatsToRemove)
      .eq('is_active', true)

    if (occupiedCount && occupiedCount > 0) {
      return {
        error: `Cannot reduce to ${newTotal} seats — ${occupiedCount} seat(s) in the removal range (seats ${newTotal + 1}–${currentCount}) have active student allocations. Vacate them first.`,
      }
    }

    // Safe to delete
    const { error: deleteErr } = await supabase
      .from('seats')
      .delete()
      .in('id', seatsToRemove)

    if (deleteErr) return { error: deleteErr.message }
  }

  // Update library record
  const updatePayload: Record<string, any> = { total_seats: newTotal }
  if (prefix !== undefined) {
    updatePayload.seat_label_prefix = prefix
  }

  const { error: updateErr } = await supabase
    .from('libraries')
    .update(updatePayload)
    .eq('id', libraryId)

  if (updateErr) return { error: updateErr.message }

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  revalidatePath('/dashboard/seat-chart')
  return { success: true }
}

// ─── CLEAR SEAT (vacate all shifts) ─────────────────────────────────────────
export async function clearSeat(seatId: string) {
  const supabase = await createClient()

  // Deactivate all allocations on this seat
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
