// ─── Enums ──────────────────────────────────────────────────────────────────
export type SeatStatus = 'occupied' | 'vacant' | 'maintenance';
export type FeeStatus = 'paid' | 'pending';

// Legacy — kept for backward compatibility with existing code paths
export type SlotType = 'morning' | 'evening' | 'night' | 'full' | 'half';

// ─── Library ────────────────────────────────────────────────────────────────
export interface Library {
  id: string;
  name: string;
  owner_id: string;
  total_seats: number;
  seat_label_prefix: string;
  created_at: string;
}

// ─── Shift (Dynamic per-library) ────────────────────────────────────────────
export interface Shift {
  id: string;
  library_id: string;
  name: string;
  start_time: string;   // "07:00:00" or "07:00"
  end_time: string;      // "13:00:00" or "13:00"
  is_full_day: boolean;
  sort_order: number;
  created_at: string;
}

// ─── Seat Allocation (one student per shift per seat) ───────────────────────
export interface SeatAllocation {
  id: string;
  seat_id: string;
  shift_id: string;
  student_id: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  // Joined data
  student?: Student;
  shift?: Shift;
}

// ─── Seat ───────────────────────────────────────────────────────────────────
export interface Seat {
  id: string;
  seat_number: number;
  library_id: string;
  status: SeatStatus;
  updated_at: string;
  // Legacy columns (kept but no longer written to)
  current_student_id?: string | null;
  current_slot?: SlotType | null;
  // New: per-shift allocations
  allocations?: SeatAllocation[];
}

// ─── Student ────────────────────────────────────────────────────────────────
export interface Student {
  id: string;
  name: string;
  phone: string;
  library_id: string;
  joined_date: string;
  joining_date: string;
  fee_due_date: string | null;
  seat_id: string | null;
  seat_number: string | null;
  monthly_fee: number;
  fee_status: FeeStatus;
  current_slot: string | null;
  preparation_field: string;
  created_at: string;
}
