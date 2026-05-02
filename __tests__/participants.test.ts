import { buildJoinIndexById, sortParticipantsByJoin } from '../utils/participants';
import type { Participant } from '../contexts/GameContext';

const fakeTimestamp = (date: Date) => ({
  toDate: () => date,
  seconds: Math.floor(date.getTime() / 1000),
  nanoseconds: 0,
});

const p = (userId: string, joinedAt: Participant['joinedAt'] | undefined): Participant => ({
  userId,
  userName: userId,
  userEmail: `${userId}@test.com`,
  joinedAt: joinedAt as Participant['joinedAt'],
});

describe('sortParticipantsByJoin', () => {
  it('sorts participants with Date joinedAt in ascending order', () => {
    const participants = [
      p('b', new Date('2024-01-02')),
      p('a', new Date('2024-01-01')),
      p('c', new Date('2024-01-03')),
    ];
    const sorted = sortParticipantsByJoin(participants);
    expect(sorted.map(x => x.userId)).toEqual(['a', 'b', 'c']);
  });

  it('sorts participants with Firestore Timestamp joinedAt', () => {
    const participants = [
      p('b', fakeTimestamp(new Date('2024-01-02')) as any),
      p('a', fakeTimestamp(new Date('2024-01-01')) as any),
    ];
    const sorted = sortParticipantsByJoin(participants);
    expect(sorted[0].userId).toBe('a');
  });

  it('does not crash when joinedAt is undefined (old game data)', () => {
    const participants = [
      p('b', undefined),
      p('a', new Date('2024-01-01')),
    ];
    expect(() => sortParticipantsByJoin(participants)).not.toThrow();
  });

  it('places undefined joinedAt participants at the end', () => {
    const participants = [
      p('b', undefined),
      p('a', new Date('2024-01-01')),
    ];
    const sorted = sortParticipantsByJoin(participants);
    expect(sorted[0].userId).toBe('a');
  });

  it('does not mutate the original array', () => {
    const participants = [
      p('b', new Date('2024-01-02')),
      p('a', new Date('2024-01-01')),
    ];
    sortParticipantsByJoin(participants);
    expect(participants[0].userId).toBe('b');
  });
});

describe('buildJoinIndexById', () => {
  it('maps each participant to a 1-based position', () => {
    const sorted = [p('a', new Date(1)), p('b', new Date(2)), p('c', new Date(3))];
    expect(buildJoinIndexById(sorted)).toEqual({ a: 1, b: 2, c: 3 });
  });

  it('returns empty object for empty array', () => {
    expect(buildJoinIndexById([])).toEqual({});
  });

  it('preserves order — first element gets index 1', () => {
    const sorted = [p('z', new Date(1)), p('a', new Date(2))];
    expect(buildJoinIndexById(sorted)).toEqual({ z: 1, a: 2 });
  });
});
