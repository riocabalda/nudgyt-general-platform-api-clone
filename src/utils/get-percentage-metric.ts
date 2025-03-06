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
  period: 'current' | 'previous',
) {
  const count = Object.keys(data[period]).length;
  const learnerScores = Object.values(data[period]);
  let totalPass = 0;
  let totalScore = 0;

  if (learnerScores) {
    for (const learnerData of learnerScores) {
      const isPassed = getLearnerIsPassed(learnerData);
      if (isPassed) {
        totalPass++;
      }
      totalScore += learnerData?.overall_correct || 0;
    }
  }

  return { count, totalScore, totalPass };
}

export function getLearnerIsPassed(
  data: {
    overall_total: number;
    overall_correct: number;
    overall_score: number;
  },
) {
  let isPassed = false;

  if ((data?.overall_correct || 0) >= data?.overall_total - 4) {
    isPassed = true;
  }

  return isPassed;
}
