import mongoose from 'mongoose';
import Simulation, { SimulationType } from '../models/simulation.model';
import createHttpError from 'http-errors';
import ServiceLevel, {
  ServiceLevelType
} from '../models/service-level.model';
import { getSimulationScore } from '../utils/simulation';

export type SimulationTypeSmall = Pick<
  SimulationType,
  'started_at' | 'ended_at'
> & {
  _id: string;
};

type DisplaySectionScore = {
  name: string;
  score: number;
  total: number;
  showScore: boolean;
  showAnswers: boolean;
};
export type DisplayScores = {
  overall: {
    score: number;
    total: number;
    percentage: number;
  };
  sections: DisplaySectionScore[];
};

async function findAllAttempts(
  learnerIdObj: mongoose.Types.ObjectId,
  serviceLevelIdObj: mongoose.Types.ObjectId,
  currentAttemptId: string
) {
  const allAttemptDocs = await Simulation.find(
    {
      learner: learnerIdObj, // Simulations of learner
      service_level: serviceLevelIdObj, // Simulations for a service level
      ended_at: { $ne: null } // Simulations that have ended
    },
    undefined,
    { sort: { started_at: -1 } } // From most to least recent
  ).lean();
  const allAttempts: SimulationTypeSmall[] = allAttemptDocs.map(
    (sim) => ({
      _id: String(sim._id),
      started_at: sim.started_at,
      ended_at: sim.ended_at
    })
  );

  let previousAttempt: SimulationTypeSmall | undefined;
  let nextAttempt: SimulationTypeSmall | undefined;

  /** Find current simulation, then infer previous and next simulations */
  allAttempts.forEach((attempt, idx) => {
    const attemptId = attempt._id;
    if (attemptId !== currentAttemptId) return;

    /**
     * Simulations are ordered from most to least recent,
     * so older simulation is next in array
     */
    previousAttempt = allAttempts[idx + 1];
    nextAttempt = allAttempts[idx - 1];
  });

  return { allAttempts, previousAttempt, nextAttempt };
}

async function getDisplayScores(simId: string) {
  const sim = await Simulation.findById(simId).lean();

  if (sim === null) throw createHttpError.NotFound();

  const serviceLevelData = await ServiceLevel.findById(
    sim.service_level
  ).lean();
  if (serviceLevelData === null) throw createHttpError.NotFound();

  const { scores } = getSimulationScore(
    serviceLevelData as ServiceLevelType,
    sim as SimulationType
  );

  return scores;
}

/** Learner is competent if their score is at 80 or higher */
async function isCompetent(
  simId: string,
  displayScores: DisplayScores,
  CS_MISTAKES_THRESHOLD = 4
) {
  const sim = await Simulation.findById(simId).lean();
  if (sim === null) throw createHttpError.NotFound();

  const serviceLevelData = await ServiceLevel.findById(
    sim.service_level
  ).lean();
  if (serviceLevelData === null) throw createHttpError.NotFound();

  const score = displayScores.overall.score;
  if (!score) {
    return false;
  }
  const total = displayScores?.overall.total;
  const mistakes = total - score;

  /** Between 0 to threshold */
  return mistakes <= CS_MISTAKES_THRESHOLD;
}

export { findAllAttempts, getDisplayScores, isCompetent };
