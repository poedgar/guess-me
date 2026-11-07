export interface ClashAssignment {
  writerId: string;
  subjectId: string;
}

export interface ClashRound {
  assignmentsA: ClashAssignment[]; // Group A member → Group B subject
  assignmentsB: ClashAssignment[]; // Group B member → Group A subject
}

export function generateClashSchedule(groupA: string[], groupB: string[]): ClashRound[] {
  const n = groupA.length;
  if (n === 0) return [];
  if (groupA.length !== groupB.length) {
    throw new Error(`generateClashSchedule requires equal-length groups (got ${groupA.length} vs ${groupB.length})`);
  }
  const rounds: ClashRound[] = [];
  for (let r = 0; r < n; r++) {
    const assignmentsA: ClashAssignment[] = groupA.map((writerId, i) => ({
      writerId,
      subjectId: groupB[(i + r) % n],
    }));
    const assignmentsB: ClashAssignment[] = groupB.map((writerId, j) => ({
      writerId,
      subjectId: groupA[(j + r) % n],
    }));
    rounds.push({ assignmentsA, assignmentsB });
  }
  return rounds;
}

/**
 * Random permutation of memberIds — the per-round leader rotation for a
 * Clash group. Since generateClashSchedule always produces exactly
 * memberIds.length rounds, this guarantees every member leads exactly one
 * round over the course of the game, in a random order.
 */
export function generateClashLeaderRotation(memberIds: string[]): string[] {
  const rotation = memberIds.slice();
  for (let i = rotation.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rotation[i], rotation[j]] = [rotation[j], rotation[i]];
  }
  return rotation;
}

/**
 * Resolves who leads a Clash group for a given round: the rotation if
 * present and in range, else the legacy static leaderId (for games created
 * before leaderRotation existed).
 */
export function getClashLeader(
  group: { leaderRotation?: string[]; leaderId?: string },
  roundIndex: number,
): string | undefined {
  return group.leaderRotation?.[roundIndex] ?? group.leaderId;
}
