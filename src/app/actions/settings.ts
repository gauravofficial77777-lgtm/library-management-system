'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateLibrarySettings(
  libraryId: string,
  name: string,
  totalSeats: number,
  prefix: string
) {
  try {
    const supabase = await createClient()

    // 1. Core metadata patch
    const { error: libError } = await supabase
      .from('libraries')
      .update({
        name: name,
        total_seats: totalSeats,
        seat_label_prefix: prefix
      })
      .eq('id', libraryId)

    if (libError) return { error: libError.message }

    // 2. Fetch existing seats safely
    const { data: existingSeats } = await supabase
      .from('seats')
      .select('id, seat_number')
      .eq('library_id', libraryId)
      .order('seat_number', { ascending: true })

    const currentSeats = existingSeats || []

    // SMART DIFFING SYSTEM: Delete or Insert missing nodes only (No blanket wipeouts)
    if (totalSeats !== currentSeats.length) {
      if (totalSeats < currentSeats.length) {
        // Downsizing layout: Delete only excess seats to lower db load
        const seatsToDelete = currentSeats.slice(totalSeats).map(s => s.id)
        if (seatsToDelete.length > 0) {
          await supabase.from('seats').delete().in('id', seatsToDelete)
        }
      } else {
        // Upsizing layout: Append missing sequential nodes directly
        const startNumber = currentSeats.length + 1
        const seatInserts = Array.from({ length: totalSeats - currentSeats.length }, (_, i) => ({
          library_id: libraryId,
          seat_number: startNumber + i,
          status: 'vacant'
        }))

        if (seatInserts.length > 0) {
          const { error: insertError } = await supabase.from('seats').insert(seatInserts)
          if (insertError) return { error: insertError.message }
        }
      }
    }

    // Purge route caching contexts instantly
    revalidatePath('/', 'layout')
    revalidatePath('/dashboard', 'page')
    revalidatePath('/dashboard/settings', 'page')

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'Pipeline process exception.' }
  }
}
