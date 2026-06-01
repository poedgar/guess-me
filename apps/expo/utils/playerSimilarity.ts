import type { Game, Participant, Round } from '@/contexts/GameContext';

export interface SimilarPair {
  userAId: string;
  userAName: string;
  userBId: string;
  userBName: string;
  averageDiff: number;
  commonRatings: number;
}

export function calculateSimilarPairs(
  rounds: Round[],
  adminAwards: Game['adminAwards'] | undefined,
  participants: Participant[],
  topN = 3,
): SimilarPair[] {
  const nameById = new Map(participants.map((p) => [p.userId, p.userName]));

  // Aggregate totals: byGiver[giverId][recipientId] = total points given
  const byGiver: Record<string, Record<string, number>> = {};

  const addPoints = (giverId: string, recipientId: string, points: number) => {
    if (!byGiver[giverId]) byGiver[giverId] = {};
    byGiver[giverId][recipientId] = (byGiver[giverId][recipientId] ?? 0) + points;
  };

  for (const round of rounds) {
    if (!round.targetPointsByPlayer) continue;
    for (const [giverId, pts] of Object.entries(round.targetPointsByPlayer)) {
      addPoints(giverId, round.targetUserId, pts);
    }
  }

  if (adminAwards) {
    for (const [giverId, awardList] of Object.entries(adminAwards)) {
      for (const award of awardList) {
        addPoints(giverId, award.recipientId, award.points);
      }
    }
  }

  const giverIds = Object.keys(byGiver);
  const pairs: SimilarPair[] = [];

  for (let i = 0; i < giverIds.length; i++) {
    for (let j = i + 1; j < giverIds.length; j++) {
      const aId = giverIds[i];
      const bId = giverIds[j];
      const aMap = byGiver[aId];
      const bMap = byGiver[bId];

      const common = Object.keys(aMap).filter((r) => r in bMap);
      if (common.length < 2) continue;

      const diffs = common.map((r) => Math.abs(aMap[r] - bMap[r]));
      const averageDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;

      pairs.push({
        userAId: aId,
        userAName: nameById.get(aId) ?? aId,
        userBId: bId,
        userBName: nameById.get(bId) ?? bId,
        averageDiff,
        commonRatings: common.length,
      });
    }
  }

  return pairs.sort((a, b) => a.averageDiff - b.averageDiff).slice(0, topN);
}
