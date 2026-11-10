import { describe, expect, it } from 'vitest';
import { AVATAR_COUNT, assignAnonymousAvatars } from '@mirror/shared';

const keys = (n: number, prefix = 'c') => Array.from({ length: n }, (_, i) => `${prefix}${i}`);

describe('assignAnonymousAvatars', () => {
  it('gives every item an in-range avatar', () => {
    const avatars = assignAnonymousAvatars(keys(10), 'game:mirror:u1');
    expect(Object.keys(avatars)).toHaveLength(10);
    for (const id of Object.values(avatars)) {
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(AVATAR_COUNT);
    }
  });

  it('never repeats an avatar within a list that fits', () => {
    const avatars = assignAnonymousAvatars(keys(AVATAR_COUNT), 'game:basket:0');
    expect(new Set(Object.values(avatars)).size).toBe(AVATAR_COUNT);
  });

  it('still assigns avatars when the list is longer than the avatar set', () => {
    const avatars = assignAnonymousAvatars(keys(AVATAR_COUNT + 5), 'seed');
    expect(Object.keys(avatars)).toHaveLength(AVATAR_COUNT + 5);
  });

  it('is the same for every viewer regardless of list order', () => {
    const list = keys(6);
    const a = assignAnonymousAvatars(list, 'game:clash:2:a');
    const b = assignAnonymousAvatars([...list].reverse(), 'game:clash:2:a');
    expect(b).toEqual(a);
  });

  it('reshuffles between rounds, so a writer is not recognisable', () => {
    // The same writer ids in different rounds should not keep their avatars.
    const writers = keys(8, 'writer');
    const round1 = assignAnonymousAvatars(writers, 'game:basket:0');
    const round2 = assignAnonymousAvatars(writers, 'game:basket:1');
    const same = writers.filter(w => round1[w] === round2[w]).length;
    expect(same).toBeLessThan(writers.length);
  });
});
