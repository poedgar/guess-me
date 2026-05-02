import type { Timestamp } from 'firebase/firestore';

export function toSafeDate(v: Date | Timestamp | null | undefined): Date {
  if (!v) return new Date();
  return (v as Timestamp).toDate?.() ?? (v as Date);
}
