import { generateBasketSchedule } from '../utils/basketSchedule';

describe('generateBasketSchedule', () => {
  it('generates N-1 rounds for N players', () => {
    expect(generateBasketSchedule(['a','b','c','d']).length).toBe(3);
    expect(generateBasketSchedule(['a','b','c']).length).toBe(2);
    expect(generateBasketSchedule(['a','b']).length).toBe(1);
    expect(generateBasketSchedule(['a']).length).toBe(0);
  });

  it('each round has exactly N assignments', () => {
    const ids = ['a','b','c','d'];
    for (const round of generateBasketSchedule(ids)) {
      expect(round.assignments.length).toBe(ids.length);
    }
  });

  it('has no self-assignments in any round', () => {
    for (const n of [2, 3, 4, 5]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      for (const round of generateBasketSchedule(ids)) {
        for (const a of round.assignments) {
          expect(a.writerId).not.toBe(a.subjectId);
        }
      }
    }
  });

  it('every player writes about every other player exactly once', () => {
    for (const n of [2, 3, 4, 5]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const pairs = new Map<string, number>();
      for (const round of generateBasketSchedule(ids)) {
        for (const a of round.assignments) {
          const key = `${a.writerId}->${a.subjectId}`;
          pairs.set(key, (pairs.get(key) ?? 0) + 1);
        }
      }
      for (const w of ids) {
        for (const s of ids) {
          if (w === s) continue;
          expect(pairs.get(`${w}->${s}`)).toBe(1);
        }
      }
    }
  });
});
