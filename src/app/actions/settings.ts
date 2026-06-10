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

    // 1. Update the core structural library data (Name, Count, and Prefix)
    const { error: libError } = await supabase
      .from('libraries')
      .update({
        name: name,
        total_seats: totalSeats,
        seat_label_prefix: prefix
      })
      .eq('id', libraryId)

    if (libError) {
      console.error('Database failure updating library node:', libError)
      return { error: libError.message }
    }

    // 2. Fetch active seat counts to prevent unneeded wipeouts
    const { data: existingSeats } = await supabase
      .from('seats')
      .select('id')
      .eq('library_id', libraryId)

    const currentCount = existingSeats ? existingSeats.length : 0

    // Only regenerate structural mapping if seat allocation metrics changed
    if (totalSeats !== currentCount) {
      // Purge historical empty seeds safely
      await supabase.from('seats').delete().eq('library_id', libraryId)

      if (totalSeats > 0) {
        // Pure sequential generator loop (1 to totalSeats) ensuring NO DUPLICATES
        const seatInserts = Array.from({ length: totalSeats }, (_, i) => ({
          library_id: libraryId,
          seat_number: i + 1,
          status: 'vacant'
        }))

        const { error: seatError } = await supabase.from('seats').insert(seatInserts)
        if (seatError) {
          console.error('Relational mapping crash during seat execution block:', seatError)
          return { error: seatError.message }
        }
      }
    }

    // Purge edge caching pipelines across the routing instances completely
    revalidatePath('/', 'layout')
    revalidatePath('/dashboard', 'page')
    revalidatePath('/dashboard/settings', 'page')

    return { success: true }
  } catch (err: any) {
    return { error: err.message || 'An unexpected pipeline processing error occurred.' }
  }
}
