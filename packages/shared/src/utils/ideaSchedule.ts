export function generateIdeaSchedule(participantIds: string[]): string[] {
  // Fisher-Yates shuffle for unpredictable round order — same technique
  // generateBasketSchedule() uses, just producing a flat ordering (one
  // round per participant) rather than per-round writer/subject pairs.
  const ids = [...participantIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
