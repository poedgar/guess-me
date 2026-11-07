import { generateClashSchedule, generateClashLeaderRotation, getClashLeader } from '../utils/clashSchedule';

describe('generateClashSchedule', () => {
  it('returns empty array for empty groups', () => {
    expect(generateClashSchedule([], [])).toEqual([]);
  });

  it('returns N rounds for N members per group', () => {
    const rounds = generateClashSchedule(['a1','a2','a3'], ['b1','b2','b3']);
    expect(rounds).toHaveLength(3);
  });

  it('every round contains all A members as writers in assignmentsA', () => {
    const groupA = ['a1','a2','a3'];
    const rounds = generateClashSchedule(groupA, ['b1','b2','b3']);
    for (const round of rounds) {
      expect(round.assignmentsA.map(a => a.writerId).sort()).toEqual(['a1','a2','a3']);
    }
  });

  it('every round contains all B members as writers in assignmentsB', () => {
    const groupB = ['b1','b2','b3'];
    const rounds = generateClashSchedule(['a1','a2','a3'], groupB);
    for (const round of rounds) {
      expect(round.assignmentsB.map(a => a.writerId).sort()).toEqual(['b1','b2','b3']);
    }
  });

  it('each A member writes about every B member exactly once across all rounds', () => {
    const groupA = ['a1','a2'];
    const groupB = ['b1','b2'];
    const rounds = generateClashSchedule(groupA, groupB);
    for (const writer of groupA) {
      const subjects = rounds.map(r => r.assignmentsA.find(a => a.writerId === writer)!.subjectId);
      expect(subjects.sort()).toEqual(['b1','b2']);
    }
  });

  it('each B member writes about every A member exactly once across all rounds', () => {
    const groupA = ['a1','a2'];
    const groupB = ['b1','b2'];
    const rounds = generateClashSchedule(groupA, groupB);
    for (const writer of groupB) {
      const subjects = rounds.map(r => r.assignmentsB.find(a => a.writerId === writer)!.subjectId);
      expect(subjects.sort()).toEqual(['a1','a2']);
    }
  });

  it('no assignment has writerId === subjectId', () => {
    const rounds = generateClashSchedule(['a1','a2','a3'], ['b1','b2','b3']);
    for (const round of rounds) {
      for (const a of [...round.assignmentsA, ...round.assignmentsB]) {
        expect(a.writerId).not.toBe(a.subjectId);
      }
    }
  });

  it('throws when groups have different lengths', () => {
    expect(() => generateClashSchedule(['a1', 'a2'], ['b1'])).toThrow();
  });
});

describe('generateClashLeaderRotation', () => {
  it('returns empty array for an empty group', () => {
    expect(generateClashLeaderRotation([])).toEqual([]);
  });

  it('returns an array of the same length as the input', () => {
    expect(generateClashLeaderRotation(['a1', 'a2', 'a3', 'a4'])).toHaveLength(4);
  });

  it('is a permutation of the input — every member appears exactly once', () => {
    const memberIds = ['a1', 'a2', 'a3', 'a4', 'a5'];
    const rotation = generateClashLeaderRotation(memberIds);
    expect(rotation.slice().sort()).toEqual(memberIds.slice().sort());
  });

  it('produces different orderings across calls (is actually randomized)', () => {
    const memberIds = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
    const orderings = new Set<string>();
    for (let i = 0; i < 20; i++) {
      orderings.add(generateClashLeaderRotation(memberIds).join(','));
    }
    // With 8! possible orderings, 20 draws landing on the same single
    // ordering every time would indicate the shuffle isn't randomizing.
    expect(orderings.size).toBeGreaterThan(1);
  });

  it('does not mutate the input array', () => {
    const memberIds = ['a1', 'a2', 'a3'];
    const original = [...memberIds];
    generateClashLeaderRotation(memberIds);
    expect(memberIds).toEqual(original);
  });
});

describe('getClashLeader', () => {
  it('returns leaderRotation[roundIndex] when leaderRotation is set', () => {
    const group = { leaderRotation: ['a1', 'a2', 'a3'] };
    expect(getClashLeader(group, 0)).toBe('a1');
    expect(getClashLeader(group, 2)).toBe('a3');
  });

  it('falls back to leaderId when leaderRotation is absent (legacy games)', () => {
    const group = { leaderId: 'a1' };
    expect(getClashLeader(group, 0)).toBe('a1');
    expect(getClashLeader(group, 5)).toBe('a1');
  });

  it('falls back to leaderId when roundIndex is out of range for leaderRotation', () => {
    const group = { leaderRotation: ['a1', 'a2'], leaderId: 'a1' };
    expect(getClashLeader(group, 5)).toBe('a1');
  });

  it('returns undefined when neither leaderRotation nor leaderId is set', () => {
    expect(getClashLeader({}, 0)).toBeUndefined();
  });
});
