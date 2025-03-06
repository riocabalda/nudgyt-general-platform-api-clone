import Simulation from '../models/simulation.model';
import mongoose from 'mongoose';
import { getSimulationScore } from './simulation';

export async function calculateLearnerExperience({
  learner,
  organization
}: {
  learner: string;
  organization: string;
}) {
  const simulatedCases = await Simulation.aggregate([
    {
      $match: {
        'service.organization': new mongoose.Types.ObjectId(
          organization
        ),
        learner: new mongoose.Types.ObjectId(learner)
      }
    },
    {
      $lookup: {
        from: 'service_level',
        localField: 'service_level',
        foreignField: '_id',
        as: 'service_level'
      }
    },
    {
      $unwind: '$service_level'
    }
  ]);

  let experience = 0;
  let latestSimulation = undefined;
  let latestOverallCorrect = 0;
  let latestOverallTotal = 0;
  let numberOfCasesAnsweredAllQuestions = 0;
  const completedExpPoints = 500;
  const competentExpPoints = 300;
  const MAX_XP = 10000;

  const experiences: Record<number, number> = {};

  for (const simulation of simulatedCases) {
    if (
      simulation?.case?.difficulty &&
      simulation?.simulation?.simulation_result?.sections_score
    ) {
      const { scores, hasAnsweredAll } = getSimulationScore(
        simulation.service_level,
        simulation
      );

      const difficulty = simulation.case.difficulty.value;

      const overallTotal = scores.overall.total;
      const overallCorrect = scores.overall.score;
      const start_at = simulation.simulation.start_at;

      if (!(difficulty in experiences)) experiences[difficulty] = 0;

      // get the latest simulated cases
      if (!latestSimulation) {
        latestSimulation = start_at;
      } else if (start_at >= latestSimulation) {
        latestSimulation = start_at;
        latestOverallCorrect = overallCorrect;
        latestOverallTotal = overallTotal;
      }

      // NOTE: 500 XP is not awarded based on whether the learner answered correctly, but rather on all the questions answered, regardless of correctness.
      if (hasAnsweredAll) {
        // add 500 exp
        numberOfCasesAnsweredAllQuestions++;
        experience += completedExpPoints;
      } else {
        if (overallCorrect >= overallTotal - 4) {
          experiences[difficulty] += competentExpPoints;
        }
      }
    }
  }

  let overallCompetentExperience = 0;
  let status = 'Needs Practice';

  if (latestOverallCorrect >= latestOverallTotal - 4) {
    status = 'Competent';
  }

  for (const key in experiences) {
    const levelDifficulty = Number(key);
    const experience = experiences[key];

    overallCompetentExperience += experience * levelDifficulty;
  }

  experience += overallCompetentExperience;
  experience = experience >= MAX_XP ? MAX_XP : experience;

  if (!experience) status = '';

  const tierDetails = getTierLevels(experience);

  return {
    ...tierDetails,
    experience,
    status,
    numberOfCasesAnsweredAllQuestions
  };
}

export function getTierLevels(exp: number) {
  const bronze = 'bronze';
  const silver = 'silver';
  const gold = 'gold';


  const tiers = {
    [bronze]: { from: 0, to: 1999 },
    [silver]: { from: 2000, to: 3999 },
    [gold]: { from: 4000, to: 10000 }
  };

  if (tiers.bronze.from <= exp && exp <= tiers.bronze.to) {
    const percentage = Math.round((exp / tiers.silver.from) * 100);
    return {
      tier: bronze,
      expUntilNextLevel: tiers.silver.from - exp,
      nextLevelExp: tiers.silver.from,
      percentage,
      nextTier: silver
    };
  } else if (tiers.silver.from <= exp && exp <= tiers.silver.to) {
    const percentage = Math.round(
      ((exp - tiers[silver].from) / tiers.bronze.to) * 100
    );
    return {
      tier: silver,
      expUntilNextLevel: tiers.gold.from - exp,
      nextLevelExp: tiers.gold.from,
      percentage,
      nextTier: gold
    };
  } else if (tiers.gold.from <= exp && exp < tiers.gold.to) {
    const silverBetweenGoldExp = tiers[gold].to - tiers[gold].from;
    const percentage = Math.round(
      ((exp - tiers[gold].from) / silverBetweenGoldExp) * 100
    );
    return {
      tier: gold,
      expUntilNextLevel: tiers.gold.to - exp,
      nextLevelExp: tiers[gold].to,
      percentage: percentage,
      nextTier: 'Max'
    };
  } else if (exp >= tiers.gold.to) {
    return {
      tier: gold,
      expUntilNextLevel: 'No More',
      nextLevelExp: tiers[gold].to,
      percentage: 100
    };
  }
}
