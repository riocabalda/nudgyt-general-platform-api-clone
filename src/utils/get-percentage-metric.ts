export default function getPercentageMetric(
  currentValue: number,
  previousValue: number
) {
  const percentageChange =
    !currentValue && !previousValue
      ? 0
      : previousValue
      ? ((currentValue - previousValue) / previousValue) * 100
      : 100;

  return {
    percentage: Math.floor(Math.abs(percentageChange)),
    isUp: currentValue ? percentageChange > 0 : false
  };
}

export function getLearnersScoreCount(
  data: {
    current: Record<
      string,
      {
        overall_total: number;
        overall_correct: number;
        overall_score: number;
      }
    >;
    previous: Record<
      string,
      {
        overall_total: number;
        overall_correct: number;
        overall_score: number;
      }
    >;
  },
  period: 'current' | 'previous'
) {
  const count = Object.keys(data[period]).length;
  const learnerScores = Object.values(data[period]);
  let totalPass = 0;
  let totalScore = 0;

  if (learnerScores) {
    for (const learnerData of learnerScores) {
      const isPassed = isLearnerPassed(learnerData);
      if (isPassed) {
        totalPass++;
      }
      totalScore += learnerData?.overall_correct || 0;
    }
  }

  return { count, totalScore, totalPass };
}

export function isLearnerPassed(data: {
  overall_total: number;
  overall_correct: number;
  overall_score: number;
}) {
  const score = data?.overall_correct || 0;
  const threshold = data?.overall_total - 4; // passing score

  // check if the score is less than 0 or the threshold is not set
  if (score <= 0 || !threshold) return false;

  // check if the score is greater than the threshold
  if (score >= threshold) return true;

  return false;
}
