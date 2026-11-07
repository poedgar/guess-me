/**
 * Cartoon player avatars.
 *
 * Avatar images live in each app (web: `public/avatars/avatar-NN.png`,
 * Expo: `assets/avatars/avatar-NN.png`), numbered 1..AVATAR_COUNT.
 * Participants store the chosen number as `avatarId`.
 */
export const AVATAR_COUNT = 27;

/**
 * Pick a random avatar id, preferring ones not already used in the game.
 * Falls back to any random avatar once every avatar is taken.
 */
export function pickAvatarId(
  takenIds: ReadonlyArray<number | undefined | null>,
  random: () => number = Math.random,
): number {
  const taken = new Set(takenIds.filter((id): id is number => typeof id === 'number'));
  const free: number[] = [];
  for (let id = 1; id <= AVATAR_COUNT; id++) {
    if (!taken.has(id)) free.push(id);
  }
  const pool = free.length > 0 ? free : Array.from({ length: AVATAR_COUNT }, (_, i) => i + 1);
  return pool[Math.floor(random() * pool.length)];
}

/**
 * Resolve a participant's avatar id. Older games predate `avatarId`, so fall
 * back to a stable hash of the user id.
 */
export function getAvatarId(participant: { userId: string; avatarId?: number | null }): number {
  const id = participant.avatarId;
  if (typeof id === 'number' && id >= 1 && id <= AVATAR_COUNT) return id;
  let hash = 0;
  for (let i = 0; i < participant.userId.length; i++) {
    hash = (hash * 31 + participant.userId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % AVATAR_COUNT) + 1;
}
