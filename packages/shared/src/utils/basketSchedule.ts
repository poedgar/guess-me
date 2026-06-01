export interface BasketAssignment {
  writerId: string;
  subjectId: string;
}

export interface BasketRound {
  assignments: BasketAssignment[];
}

export function generateBasketSchedule(participantIds: string[]): BasketRound[] {
  const n = participantIds.length;
  if (n < 2) return [];

  // Fisher-Yates shuffle for unpredictable order
  const ids = [...participantIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const rounds: BasketRound[] = [];
  for (let r = 0; r < n - 1; r++) {
    const assignments: BasketAssignment[] = ids.map((writerId, i) => ({
      writerId,
      subjectId: ids[(i + r + 1) % n],
    }));
    rounds.push({ assignments });
  }
  return rounds;
}
