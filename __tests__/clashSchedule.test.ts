import { generateClashSchedule } from '../utils/clashSchedule';

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
});
