import { SlotType } from '@/types/database'

export function getCurrentSlot(): SlotType {
  const hour = new Date().getHours()
  if (hour >= 7 && hour < 13) return 'morning'
  if (hour >= 13 && hour < 19) return 'evening'
  return 'night' // 19:00 - 06:59
}

export function getSlotLabel(slot: string | null | undefined): string {
  if (!slot) return 'Not Assigned'
  const labels: Record<string, string> = {
    morning: 'Morning (7 AM – 1 PM)',
    afternoon: 'Afternoon (1 PM – 6 PM)',
    evening: 'Evening (1 PM – 7 PM)',
    night: 'Night (7 PM – 7 AM)',
    full: 'Full Day (7 AM – 11 PM)',
    half: 'Half Day (7 AM – 7 PM)',
  }
  return labels[slot] || slot
}

export function isSlotActive(slot: SlotType | null): boolean {
  if (!slot) return false
  const currentSlot = getCurrentSlot()
  if (slot === 'full') return true
  if (slot === 'half') return currentSlot === 'morning' || currentSlot === 'evening'
  return slot === currentSlot
}

// ─── Dynamic Shift Helpers ──────────────────────────────────────────────────

/**
 * Format a time string like "07:00:00" or "07:00" to "7:00 AM"
 */
export function formatTime(time: string | null | undefined): string {
  if (!time) return ''
  const parts = time.split(':')
  let hours = parseInt(parts[0], 10)
  const minutes = parts[1] || '00'
  const period = hours >= 12 ? 'PM' : 'AM'
  if (hours === 0) hours = 12
  else if (hours > 12) hours -= 12
  return `${hours}:${minutes} ${period}`
}

/**
 * Get a short label for a shift, e.g., "7 AM – 1 PM"
 */
export function formatShiftTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(startTime)} – ${formatTime(endTime)}`
}

/**
 * Check if a shift is currently active based on the current time of day
 */
export function isShiftActive(startTime: string, endTime: string): boolean {
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  const startParts = startTime.split(':')
  const startMinutes = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1] || '0', 10)

  const endParts = endTime.split(':')
  const endMinutes = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1] || '0', 10)

  // Handle overnight shifts (e.g., 22:00 to 07:00)
  if (endMinutes <= startMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }
  return currentMinutes >= startMinutes && currentMinutes < endMinutes
}

export function generateWhatsAppLink(
  phone: string,
  name: string,
  dueDate: string | null
): string {
  const cleanPhone = phone.replace(/\D/g, '')
  const phoneWithCountry = cleanPhone.startsWith('91')
    ? cleanPhone
    : `91${cleanPhone}`

  const dueDateStr = dueDate
    ? new Date(dueDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : 'N/A'

  const message = `Hi ${name}, this is a reminder that your library fee is due on ${dueDateStr}. Please clear your dues at the earliest. Thank you!`

  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`
}

export function formatDate(date: string | null): string {
  if (!date) return 'N/A'
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
