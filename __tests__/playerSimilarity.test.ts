import { calculateSimilarPairs } from '../utils/playerSimilarity';
import type { Round, Participant, Game } from '../contexts/GameContext';

const p = (userId: string, userName: string): Participant => ({
  userId,
  userName,
  userEmail: `${userId}@test.com`,
  joinedAt: new Date(),
});

const round = (
  roundNumber: number,
  targetUserId: string,
  targetPointsByPlayer: Record<string, number>,
): Round => ({
  roundNumber,
  targetUserId,
  targetUserName: 'Target',
  comments: [],
  commentsVisible: false,
  pointsGiven: false,
  startedAt: new Date(),
  targetPointsByPlayer,
});

const awards = (entries: Record<string, { recipientId: string; points: number }[]>): Game['adminAwards'] => {
  const result: NonNullable<Game['adminAwards']> = {};
  for (const [giverId, list] of Object.entries(entries)) {
    result[giverId] = list.map(({ recipientId, points }) => ({
      recipientId,
      points,
      awardedBy: giverId,
      awardedAt: new Date(),
    }));
  }
  return result;
};

describe('calculateSimilarPairs', () => {
  it('returns empty array when no rounds and no awards', () => {
    const result = calculateSimilarPairs([], undefined, [p('a', 'Alice'), p('b', 'Bob')]);
    expect(result).toEqual([]);
  });

  it('excludes pair with only 1 common rating', () => {
    const rounds = [round(1, 'c', { a: 5, b: 7 })];
    const result = calculateSimilarPairs(rounds, undefined, [p('a', 'Alice'), p('b', 'Bob'), p('c', 'Carol')]);
    expect(result).toHaveLength(0);
  });

  it('returns pair with averageDiff 0 when both users gave identical points', () => {
    const rounds = [
      round(1, 'c', { a: 5, b: 5 }),
      round(2, 'd', { a: 8, b: 8 }),
    ];
    const result = calculateSimilarPairs(rounds, undefined, [
      p('a', 'Alice'), p('b', 'Bob'), p('c', 'Carol'), p('d', 'Dave'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].averageDiff).toBe(0);
    expect(result[0].commonRatings).toBe(2);
  });

  it('calculates correct averageDiff across two rounds', () => {
    // a gave 6, b gave 4 → diff 2
    // a gave 3, b gave 9 → diff 6
    // avg = 4
    const rounds = [
      round(1, 'c', { a: 6, b: 4 }),
      round(2, 'd', { a: 3, b: 9 }),
    ];
    const result = calculateSimilarPairs(rounds, undefined, [
      p('a', 'Alice'), p('b', 'Bob'), p('c', 'Carol'), p('d', 'Dave'),
    ]);
    expect(result[0].averageDiff).toBe(4);
  });

  it('sorts pairs by averageDiff ascending (most similar first)', () => {
    // pair (a,b): diffs 1, 1 → avg 1
    // pair (a,c): diffs 5, 5 → avg 5
    const rounds = [
      round(1, 'd', { a: 5, b: 6, c: 10 }),
      round(2, 'e', { a: 5, b: 6, c: 10 }),
    ];
    const result = calculateSimilarPairs(rounds, undefined, [
      p('a', 'Alice'), p('b', 'Bob'), p('c', 'Carol'), p('d', 'Dave'), p('e', 'Eve'),
    ]);
    expect(result[0].averageDiff).toBeLessThan(result[1].averageDiff);
    expect(result[0].userAId === 'a' || result[0].userBId === 'a').toBe(true);
    expect(result[0].userAId === 'b' || result[0].userBId === 'b').toBe(true);
  });

  it('limits results to topN', () => {
    const rounds = [
      round(1, 'x', { a: 1, b: 2, c: 3 }),
      round(2, 'y', { a: 1, b: 2, c: 3 }),
    ];
    const ps = [p('a', 'A'), p('b', 'B'), p('c', 'C'), p('x', 'X'), p('y', 'Y')];
    expect(calculateSimilarPairs(rounds, undefined, ps, 1)).toHaveLength(1);
    expect(calculateSimilarPairs(rounds, undefined, ps, 2)).toHaveLength(2);
  });

  it('includes post-guessing awards in the comparison', () => {
    // Only 1 common target rating → not enough alone
    // But 1 post-guessing award to same person → total 2 common ratings
    const rounds = [round(1, 'c', { a: 4, b: 6 })];
    const postGuessing = awards({
      a: [{ recipientId: 'd', points: 3 }],
      b: [{ recipientId: 'd', points: 5 }],
    });
    const result = calculateSimilarPairs(rounds, postGuessing, [
      p('a', 'Alice'), p('b', 'Bob'), p('c', 'Carol'), p('d', 'Dave'),
    ]);
    // diff from round: |4-6|=2, diff from award: |3-5|=2 → avg 2
    expect(result).toHaveLength(1);
    expect(result[0].averageDiff).toBe(2);
    expect(result[0].commonRatings).toBe(2);
  });

  it('includes correct user names in the result', () => {
    const rounds = [
      round(1, 'c', { a: 5, b: 5 }),
      round(2, 'd', { a: 5, b: 5 }),
    ];
    const result = calculateSimilarPairs(rounds, undefined, [
      p('a', 'Alice'), p('b', 'Bob'), p('c', 'Carol'), p('d', 'Dave'),
    ]);
    const names = [result[0].userAName, result[0].userBName];
    expect(names).toContain('Alice');
    expect(names).toContain('Bob');
  });

  it('aggregates multiple awards to same recipient before comparing', () => {
    // a gave 3+3=6 total to 'x', b gave 5+1=6 total to 'x' → diff 0
    // a gave 4 to 'y', b gave 4 to 'y' → diff 0
    const postGuessing = awards({
      a: [{ recipientId: 'x', points: 3 }, { recipientId: 'x', points: 3 }, { recipientId: 'y', points: 4 }],
      b: [{ recipientId: 'x', points: 5 }, { recipientId: 'x', points: 1 }, { recipientId: 'y', points: 4 }],
    });
    const result = calculateSimilarPairs([], postGuessing, [
      p('a', 'Alice'), p('b', 'Bob'), p('x', 'X'), p('y', 'Y'),
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].averageDiff).toBe(0);
  });
});
