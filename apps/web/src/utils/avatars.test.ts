import { describe, expect, it } from 'vitest';
import { AVATAR_COUNT, getAvatarId, pickAvatarId } from '@mirror/shared';

describe('pickAvatarId', () => {
  it('returns an id in range', () => {
    for (let i = 0; i < 100; i++) {
      const id = pickAvatarId([]);
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(AVATAR_COUNT);
    }
  });

  it('never picks an avatar already used while free ones remain', () => {
    const taken = Array.from({ length: AVATAR_COUNT - 1 }, (_, i) => i + 1);
    for (let i = 0; i < 20; i++) {
      expect(pickAvatarId(taken)).toBe(AVATAR_COUNT);
    }
  });

  it('ignores missing ids from legacy participants', () => {
    expect(pickAvatarId([undefined, null], () => 0)).toBe(1);
  });

  it('falls back to any avatar when all are taken', () => {
    const all = Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1);
    const id = pickAvatarId(all, () => 0.5);
    expect(id).toBeGreaterThanOrEqual(1);
    expect(id).toBeLessThanOrEqual(AVATAR_COUNT);
  });
});

describe('getAvatarId', () => {
  it('uses the stored avatarId', () => {
    expect(getAvatarId({ userId: 'u1', avatarId: 7 })).toBe(7);
  });

  it('derives a stable in-range id for legacy participants', () => {
    const a = getAvatarId({ userId: 'legacy-user' });
    expect(a).toBe(getAvatarId({ userId: 'legacy-user' }));
    expect(a).toBeGreaterThanOrEqual(1);
    expect(a).toBeLessThanOrEqual(AVATAR_COUNT);
  });

  it('ignores out-of-range stored ids', () => {
    const id = getAvatarId({ userId: 'u2', avatarId: 999 });
    expect(id).toBeGreaterThanOrEqual(1);
    expect(id).toBeLessThanOrEqual(AVATAR_COUNT);
  });
});
