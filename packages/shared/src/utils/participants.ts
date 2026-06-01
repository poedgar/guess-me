import type { Participant } from '../types';
import type { Timestamp } from 'firebase/firestore';

function joinedAtToMs(v: Participant['joinedAt'] | undefined | null): number {
  if (!v) return Number.MAX_SAFE_INTEGER;
  if (typeof (v as Timestamp).toDate === 'function') {
    return (v as Timestamp).toDate().getTime();
  }
  return (v as Date).getTime();
}

export function sortParticipantsByJoin(participants: Participant[]): Participant[] {
  return participants.slice().sort((a, b) => joinedAtToMs(a.joinedAt) - joinedAtToMs(b.joinedAt));
}

export function buildJoinIndexById(participants: Participant[]): Record<string, number> {
  return Object.fromEntries(participants.map((p, i) => [p.userId, i + 1]));
}
