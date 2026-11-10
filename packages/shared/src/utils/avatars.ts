/**
 * Cartoon avatars for anonymous content (comments, ideas).
 *
 * Avatar images live in each app (web: `public/avatars/avatar-NN.png`,
 * Expo: `assets/avatars/avatar-NN.png`), numbered 1..AVATAR_COUNT.
 *
 * Real players never get an avatar: an avatar marks something anonymous.
 * So the assignment must not leak who wrote what:
 *  - it depends only on the item keys and a per-round seed, never on author
 *    order, so the same author gets unrelated avatars in different rounds;
 *  - avatars within one list are all different (until the list outgrows
 *    AVATAR_COUNT), so two cards never look like "the same person";
 *  - it is deterministic, so every player sees the same avatar on a card.
 */
export const AVATAR_COUNT = 27;

/** 32-bit FNV-1a hash. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Small seeded PRNG (mulberry32) returning floats in [0, 1). */
function seededRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Give each anonymous item in a list its own random-looking avatar.
 *
 * @param keys  Stable ids of the items shown together (comment ids, writer
 *              ids, idea ids). Pass the full list for the round, not a
 *              filtered subset, so a card keeps its avatar across screens.
 * @param seed  Unique per list instance, e.g. `${gameId}:basket:${round}`.
 * @returns     Map from key to avatar id (1..AVATAR_COUNT).
 */
export function assignAnonymousAvatars(
  keys: ReadonlyArray<string>,
  seed: string,
): Record<string, number> {
  const unique = Array.from(new Set(keys));
  // Order items by a seeded hash, so the order (and thus the avatar) has
  // nothing to do with who wrote them or when.
  const ordered = unique
    .map((key) => ({ key, rank: hash(`${seed}|${key}`) }))
    .sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : 1));

  // Seeded shuffle of all avatars; hand them out in that order.
  const pool = Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1);
  const random = seededRandom(hash(seed));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const result: Record<string, number> = {};
  ordered.forEach(({ key }, i) => {
    result[key] = pool[i % pool.length];
  });
  return result;
}
