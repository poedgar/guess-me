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
