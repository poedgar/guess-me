import { describe, expect, it } from 'vitest';
import { generateClashLeaderRotation, getClashLeader } from '@mirror/shared';

describe('generateClashLeaderRotation (web import of @mirror/shared)', () => {
  it('is a permutation of the input — every member appears exactly once', () => {
    const memberIds = ['a1', 'a2', 'a3', 'a4', 'a5'];
    const rotation = generateClashLeaderRotation(memberIds);
    expect(rotation.slice().sort()).toEqual(memberIds.slice().sort());
  });

  it('returns empty array for an empty group', () => {
    expect(generateClashLeaderRotation([])).toEqual([]);
  });
});

describe('getClashLeader (web import of @mirror/shared)', () => {
  it('returns leaderRotation[roundIndex] when set', () => {
    expect(getClashLeader({ leaderRotation: ['a1', 'a2', 'a3'] }, 1)).toBe('a2');
  });

  it('falls back to leaderId when leaderRotation is absent (legacy games)', () => {
    expect(getClashLeader({ leaderId: 'a1' }, 3)).toBe('a1');
  });
});
