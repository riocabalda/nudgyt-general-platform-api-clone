import createHttpError from 'http-errors';
import { startCase } from 'lodash';
import mongoose from 'mongoose';
import { SimulationLogType } from '../../constants/logs';
import messages from '../../constants/response-messages';
import { ANSWER_NOT_REQUIRED } from '../../constants/simulation';
import { decryptFieldData, encryptFieldData } from '../../helpers/db';
import {
  findAllAttempts,
  getDisplayScores,
  isCompetent
} from '../../helpers/simulation-results';
import { RequestAuth } from '../../middlewares/require-permissions';
import AgentSoftSkill from '../../models/agent-softskill.model';
import Organization from '../../models/organization.model';
import ServiceLevel, {
  ServiceLevelType
} from '../../models/service-level.model';
import Service, { ServiceType } from '../../models/service.model';
import Simulation, {
  SimulationType,
  UserFormAnswersType
} from '../../models/simulation.model';
import AgentTranscriptSummary from '../../models/agent-transcript-summary.model';
import User, { UserType } from '../../models/user.model';
import dayjsUTCDate from '../../utils/dayjs-utc-date';
import {
  convertMilliseconds,
  getSimulationUsedTime
} from '../../utils/metric-date-and-time-helpers';
import {
  getSimulationScore,
  RawSkillRegex,
  RawSkillRegexSchema,
  SKILL_ASSESSMENT_RUBRICS,
  SKILL_IMPORTANCE,
  SoftSkillRating,
  SoftSkillsData
} from '../../utils/simulation';
import { withFromAndTo } from '../../utils/with-from-to';
import logService from '../log.service';
import socketManager from '../../websocket/socket-manager';
import calculateEndedAtTimestamp from '../../utils/calculate-ended-at-timestamp';

async function startSimulation(
  payloadIds: Record<string, string>,
  user: UserType,
  reqAuth: RequestAuth
) {
  const { serviceId, serviceLevelId } = payloadIds;

  const existingServiceLevel = await ServiceLevel.findByIdAndUpdate(
    { _id: serviceLevelId },
    { last_attempt: new Date() }
  );

  const existingUser = await User.findById(user._id);

  if (!existingServiceLevel || !existingUser)
    throw createHttpError.NotFound(
      messages.SERVICE_LEVEL_USER_NOT_FOUND
    );

  const formQuestions = existingServiceLevel.form_questions;
  if (!formQuestions) throw Error(messages.FORM_QUESTIONS_NOT_FOUND);

  // Creating form_answers from the service level's formQuestions
  const formAnswers = formQuestions.map((question) => {
    const answer =
      question.pre_fill.toLowerCase() === 'yes'
        ? question.correct_answer
        : '';

    return {
      section: question.section,
      question_no: question.question_no,
      answer
    };
  });

  const existingSimulation = await Simulation.findOne({
    ended_at: null,
    service: serviceId,
    service_level: serviceLevelId,
    learner: user._id
  });

  if (existingSimulation) return existingSimulation;

  const payload: Partial<SimulationType> = {
    learner: new mongoose.Types.ObjectId(user._id),
    service: new mongoose.Types.ObjectId(serviceId),
    service_level: new mongoose.Types.ObjectId(serviceLevelId),
    started_at: new Date(),
    paused_at: [new Date()],
    form_answers: formAnswers
  };

  const newSimulation = await Simulation.create(payload);

  /** Find service */
  const service = await Service.findById(serviceId);
  if (service === null) {
    throw createHttpError.NotFound(messages.SERVICE_NOT_FOUND);
  }

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const serviceTitle = service.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      serviceId,
      serviceLevelId,
      userId: user._id
    }),
    type: SimulationLogType.START,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) started simulation of ${serviceTitle}`
    )
  });

  return newSimulation;
}

async function getSimulationById({
  simulationId,
  userId
}: {
  simulationId: string;
  userId: string;
}) {
  const simulation = await Simulation.findById(simulationId);

  if (!simulation)
    throw createHttpError.NotFound(messages.SIMULATION_NOT_FOUND);

  if (simulation.learner.toString() !== userId)
    throw createHttpError.Forbidden(
      messages.SIMULATION_UNAUTHORIZED_ACCESS
    );

  const serviceLevel = (await ServiceLevel.findById(
    simulation.service_level
  )) as any;

  if (!serviceLevel)
    throw createHttpError.NotFound(messages.SERVICE_NOT_FOUND);

  return {
    ...simulation.toObject(),
    time_limit: serviceLevel.time_limit
  };
}

async function stopSimulation(
  simulationId: string,
  userFormAnswers: UserFormAnswersType,
  user: UserType,
  reqAuth: RequestAuth
): Promise<{ message: string }> {
  const existingSimulation = await Simulation.findById(simulationId);
  if (!existingSimulation) throw Error(messages.SIMULATION_NOT_FOUND);
  if (existingSimulation.ended_at)
    throw Error(messages.SIMULATION_ENDED);

  const serviceLevel = await ServiceLevel.findById(
    existingSimulation.service_level
  );
  if (!serviceLevel) throw Error(messages.SERVICE_NOT_FOUND);

  /** Find service */
  const service = await Service.findById(existingSimulation.service);
  if (service === null) {
    throw createHttpError.NotFound(messages.SERVICE_NOT_FOUND);
  }

  const formQuestions = serviceLevel.form_questions;

  if (!formQuestions) {
    await Simulation.updateOne(
      { _id: simulationId },
      {
        ended_at: calculateEndedAtTimestamp(
          existingSimulation,
          serviceLevel
        )
      }
    );
    return { message: messages.SIMULATION_UPDATED };
  }
  // Creating form_answers from the service_level's form_questions
  const formAnswers = formQuestions.map((question) => {
    const section = userFormAnswers[question.section];
    const answer =
      section && section[question.question_no]?.trim() !== ''
        ? section[question.question_no]
        : '';

    return {
      section: question.section,
      question_no: question.question_no,
      answer
    };
  });

  /**
   *  initializing default section_score from simulation_result field
   *  total here is the total count of the questions
   *  correct here is the correct count of the questions
   *  */
  const sectionScore: {
    [key: string]: { total: number; correct: number };
  } = {};

  formAnswers.forEach((form) => {
    const form_question = formQuestions.find(
      (q) =>
        q.section === form.section && q.question_no === form.question_no
    );

    // if true, will not be included in the calculation (if the question is Notes, form_question correct answer is blank, answer is not required, or answer is not in the form_question)
    if (
      form.question_no === 'Notes' ||
      form_question?.correct_answer === '' ||
      form.answer === ANSWER_NOT_REQUIRED
    )
      return;

    if (!sectionScore[form.section]) {
      sectionScore[form.section] = { total: 0, correct: 0 };
    }

    sectionScore[form.section].total += 1;

    if (form_question?.correct_answer === form.answer) {
      sectionScore[form.section].correct += 1;
    }
  });

  // Actual calculation of the total correct count over the total question from form_questions
  const sectionScores = Object.entries(sectionScore).map(
    ([section, { correct, total }]) => {
      const score = (correct / total) * 100;
      return {
        section,
        score,
        correct,
        total
      };
    }
  );

  // Getting overall correct count from all sections
  const overall_correct = sectionScores.reduce(
    (sum, section) => sum + section.correct,
    0
  );

  // Getting overall total count from all sections
  const overall_total = sectionScores.reduce(
    (sum, section) => sum + section.total,
    0
  );

  // Getting the overall score in percent value
  let overallScorePercent = 0;
  if (overall_total > 0) {
    overallScorePercent = (overall_correct / overall_total) * 100;
  }

  await Simulation.updateOne(
    { _id: simulationId },
    {
      ended_at: calculateEndedAtTimestamp(
        existingSimulation,
        serviceLevel
      ),
      form_answers: formAnswers,
      simulation_result: {
        sections_score: sectionScores,
        overall_score: overallScorePercent,
        overall_correct: overall_correct,
        overall_total: overall_total
      }
    }
  );

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const serviceTitle = service.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      simulationId
    }),
    type: SimulationLogType.FINISH,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) finished simulation of ${serviceTitle}`
    )
  });

  return { message: messages.SIMULATION_COMPLETED };
}

async function updateFormAnswers(
  simulationId: string,
  userFormAnswers: UserFormAnswersType
) {
  const simulation = await Simulation.findById(simulationId);
  if (!simulation)
    throw createHttpError.NotFound(messages.SIMULATION_NOT_FOUND);

  const serviceLevel = await ServiceLevel.findById(
    simulation.service_level
  );
  if (!serviceLevel)
    throw createHttpError.NotFound(messages.SERVICE_NOT_FOUND);

  const formQuestions = serviceLevel.form_questions;
  if (!formQuestions) throw Error(messages.FORM_QUESTIONS_NOT_FOUND);

  // Creating form_answers from the service_level's formQuestions
  const formAnswers = formQuestions.map((question) => {
    const section = userFormAnswers[question.section];
    const answer =
      section && section[question.question_no]?.trim() !== ''
        ? section[question.question_no]
        : '';

    return {
      section: question.section,
      question_no: question.question_no,
      answer
    };
  });

  await Simulation.updateOne(
    { _id: simulationId },
    { form_answers: formAnswers }
  );

  return { message: messages.SIMULATION_UPDATED };
}

async function pauseSimulationTime(simulationId: string) {
  const simulation = await Simulation.findById(simulationId).populate(
    'service_level'
  );

  const timeLimitInMilliseconds = (
    simulation?.service_level as ServiceLevelType
  ).time_limit;
  const timeUsedInMilliseconds = getSimulationUsedTime(simulation);
  const timeRemainingInMilliseconds =
    (timeLimitInMilliseconds || 0) - timeUsedInMilliseconds;

  const canPause =
    (simulation?.started_at &&
      simulation?.resumed_at.length === 0 &&
      simulation?.paused_at.length === 0 &&
      !simulation.ended_at) ||
    (simulation?.started_at &&
      simulation?.resumed_at.length >= simulation?.paused_at.length &&
      !simulation.ended_at);

  const hasTimeRemaining =
    timeLimitInMilliseconds === -1 ||
    (timeLimitInMilliseconds !== -1 && timeRemainingInMilliseconds > 0);

  if (canPause && hasTimeRemaining) {
    const updatedSimulation = await Simulation.findByIdAndUpdate(
      simulationId,
      { $push: { paused_at: dayjsUTCDate() } },
      {
        new: true
      }
    );
    if (!updatedSimulation) throw createHttpError.NotFound();

    // Emit the 'time-updated' event when the simulation time is successfully paused
    const io = socketManager.getIO();
    if (io) io.emit('time-updated', { simulation_id: simulationId });
  }
}

async function resumeSimulationTime(simulationId: string) {
  const simulation = await Simulation.findById(simulationId).populate(
    'service_level'
  );

  const timeLimitInMilliseconds = (
    simulation?.service_level as ServiceLevelType
  ).time_limit;
  const timeUsedInMilliseconds = getSimulationUsedTime(simulation);
  const timeRemainingInMilliseconds =
    (timeLimitInMilliseconds || 0) - timeUsedInMilliseconds;

  const canResume =
    simulation?.started_at &&
    simulation?.paused_at.length > simulation?.resumed_at.length;

  const hasTimeRemaining =
    timeLimitInMilliseconds === -1 ||
    (timeLimitInMilliseconds !== -1 && timeRemainingInMilliseconds > 0);

  if (canResume && hasTimeRemaining) {
    const updatedSimulation = await Simulation.findByIdAndUpdate(
      simulationId,
      { $push: { resumed_at: dayjsUTCDate() } },
      {
        new: true
      }
    );
    if (!updatedSimulation) throw createHttpError.NotFound();
  }
}

async function getSimulationServiceDetails({
  simulationId,
  orgSlug,
  learnerId
}: {
  simulationId: string;
  orgSlug: string;
  learnerId: string;
}) {
  if (!orgSlug) {
    throw createHttpError.Conflict('Organization Slug is required');
  }
  const orgSlugHash = encryptFieldData(orgSlug);

  const organization = await Organization.findOne({
    'slug.hash': orgSlugHash.hash
  });

  if (!organization) {
    throw createHttpError.Conflict('Organization not found');
  }

  const simulation = (await Simulation.findOne({
    _id: simulationId,
    learner: learnerId
  })
    .populate('service service_level')
    .populate([
      {
        path: 'service',
        populate: {
          path: 'basic_level'
        }
      },
      {
        path: 'service',
        populate: {
          path: 'multi_level'
        }
      }
    ])) as unknown as SimulationType & {
    service: ServiceType;
    service_level: ServiceLevelType;
  };

  if (!simulation) {
    throw createHttpError.Conflict('Simulation not found');
  }

  const simulationServiceDetails = {
    simulationId: simulation._id,
    startedAt: simulation.started_at,
    endedAt: simulation.ended_at,
    serviceType:
      simulation.service.basic_level !== null ? 'Basic' : 'Multi',
    service: {
      _id: simulation.service._id,
      cover_image: simulation.service.cover_image,
      title: simulation.service.title,
      description: simulation.service.description
    },
    service_level: {
      _id: simulation.service_level._id,
      title: simulation.service_level.title,
      description: simulation.service_level.description
    },
    description:
      simulation.service.basic_level !== null
        ? simulation.service.description
        : simulation.service.description
  };

  return simulationServiceDetails;
}

async function getSimulationDates({
  simulationId,
  orgSlug,
  learnerId
}: {
  simulationId: string;
  orgSlug: string;
  learnerId: string;
}) {
  if (!orgSlug) {
    throw createHttpError.Conflict('Organization Slug is required');
  }
  const orgSlugHash = encryptFieldData(orgSlug);

  const organization = await Organization.findOne({
    'slug.hash': orgSlugHash.hash
  });

  if (!organization) {
    throw createHttpError.Conflict('Organization not found');
  }

  const simulation = await Simulation.findOne({
    _id: simulationId,
    learner: learnerId
  });

  if (!simulation) {
    throw createHttpError.Conflict('Simulation not found');
  }

  const { allAttempts, previousAttempt, nextAttempt } =
    await findAllAttempts(
      new mongoose.Types.ObjectId(simulation.learner._id),
      simulation.service_level as any,
      simulationId
    );

  const dates = allAttempts.map((date) => {
    return {
      id: date._id,
      date: date.started_at,
      isSelected: date._id.toString() === simulationId
    };
  });

  return {
    dates,
    previousAttempt,
    nextAttempt
  };
}

async function getSimulationDetails({
  simulationId,
  orgSlug,
  learnerId
}: {
  simulationId: string;
  orgSlug: string;
  learnerId: string;
}) {
  if (!orgSlug) {
    throw createHttpError.Conflict('Organization Slug is required');
  }

  const orgSlugHash = encryptFieldData(orgSlug);

  const organization = await Organization.findOne({
    'slug.hash': orgSlugHash.hash
  });

  if (!organization) {
    throw createHttpError.Conflict('Organization not found');
  }

  const simulation = await Simulation.findOne({
    _id: new mongoose.Types.ObjectId(simulationId),
    ended_at: { $ne: null } // Simulation must be finished
  });

  if (!simulation) {
    throw createHttpError.Conflict('Simulation not found');
  }

  const serviceLevelData = await ServiceLevel.findById(
    simulation.service_level
  )
    .populate('creator', 'fullname email')
    .populate({
      path: 'characters',
      populate: {
        path: 'avatar'
      }
    })
    .populate('environment')
    .lean();

  if (serviceLevelData === null) {
    throw createHttpError.NotFound(); // Should be impossible...
  }

  const learner = await User.findById(simulation.learner).lean();
  if (learner === null) {
    throw createHttpError.NotFound();
  }

  const agentTranscriptSummary = await AgentTranscriptSummary.findOne({
    simulation: simulation._id
  });

  const displayScores = await getDisplayScores(simulationId);
  const totalTIme = getSimulationUsedTime(simulation);
  const totalTimeInSeconds = convertMilliseconds(totalTIme);
  const isSimulationCompetent = await isCompetent(
    simulationId,
    displayScores
  );

  return {
    hasFormQuestions: serviceLevelData.form_questions.length > 0,
    displayScores,
    totalCompletedTime: totalTimeInSeconds.timeString,
    characters: serviceLevelData.characters,
    environment: serviceLevelData.environment,
    isCompetent: isSimulationCompetent,
    formQuestions: serviceLevelData.form_questions,
    formAnswers: simulation.form_answers,
    transcriptSummary: agentTranscriptSummary?.summary
  };
}

async function getSimulationSoftSkills({
  simulationId,
  orgSlug
}: {
  simulationId: string;
  orgSlug: string;
}) {
  if (!orgSlug) {
    throw createHttpError.Conflict('Organization Slug is required');
  }

  const orgSlugHash = encryptFieldData(orgSlug);

  const organization = await Organization.findOne({
    'slug.hash': orgSlugHash.hash
  });

  if (!organization) {
    throw createHttpError.Conflict('Organization not found');
  }

  const softSkillDoc = await AgentSoftSkill.findOne({
    simulation_id: simulationId
  });
  if (softSkillDoc === null) return null;

  const dynamicData = softSkillDoc.soft_skills_feedback ?? null;
  if (dynamicData === null) return null;

  /** Dynamic data only contains numerical data for now */
  const NO_DYNAMIC_DATA_TEXT = '';

  const parts = dynamicData.split(', ');

  const data: SoftSkillsData = {
    summary: NO_DYNAMIC_DATA_TEXT,
    ratings: []
  };
  for (const part of parts) {
    const match = part.match(RawSkillRegex)?.groups;
    if (match === undefined) continue;

    const { data: parsed } = RawSkillRegexSchema.safeParse(match);
    if (parsed === undefined) continue;

    const { raw_skill, score, total } = parsed;
    const skill = startCase(raw_skill);
    const importance = SKILL_IMPORTANCE[skill] ?? '';
    const assessment = SKILL_ASSESSMENT_RUBRICS[skill] ?? [];

    const rating: SoftSkillRating = {
      ...{ skill, score, total, description: NO_DYNAMIC_DATA_TEXT },
      ...{ importance, assessment }
    };

    data.ratings.push(rating);
  }

  return data;
}

async function getPreviousAttemptSimulations(
  learnerId: mongoose.Types.ObjectId | undefined,
  page: string,
  serviceId: string,
  includeOngoing?: boolean
) {
  let query: any = {};
  page = page || '1';
  const andQueries = [];
  const pageSize = 5;
  const MIN_MISTAKES = 4;

  andQueries.push({ deleted_at: { $eq: null } });

  if (learnerId) {
    andQueries.push({ learner: { $eq: learnerId } });
    andQueries.push({ service: { $eq: serviceId } });
    if (!includeOngoing) {
      andQueries.push({ ended_at: { $ne: null } });
    }
  }

  if (andQueries.length) {
    query = { $and: andQueries };
  }

  let simulations = await Simulation.paginate(query, {
    sort: { started_at: -1 },
    page: Number(page),
    limit: pageSize,
    populate: { path: 'service_level' }
  });

  const { data, ...otherOptions } = withFromAndTo(simulations);
  const previousAttempts: {
    simulation_id?: string;
    started_at?: Date;
    score?: number;
    competency?: string;
    paused_at?: Date;
    ended_at?: Date;
  }[] = [];

  for (const simulation of data) {
    if (!includeOngoing) {
      const scoreDetails = getSimulationScore(
        simulation.service_level,
        simulation
      );

      if (scoreDetails?.scores?.overall) {
        const mistakes =
          scoreDetails.scores.overall.total -
          scoreDetails.scores.overall.score;

        const simulatedData = {
          simulation_id: simulation._id.toString(),
          started_at: simulation.started_at as Date,
          score: scoreDetails.scores.overall.percentage,
          competency: 'Needs Practice',
          paused_at: simulation.paused_at,
          ended_at: simulation.ended_at
        };

        if (mistakes <= MIN_MISTAKES) {
          simulatedData.competency = 'Competent';
        }

        previousAttempts.push(simulatedData);
      }
    }

    if (includeOngoing) {
      previousAttempts.push({
        paused_at: simulation.paused_at,
        ended_at: simulation.ended_at
      });
    }
  }

  return { data: previousAttempts, ...otherOptions };
}

export default {
  startSimulation,
  stopSimulation,
  getSimulationById,
  updateFormAnswers,
  pauseSimulationTime,
  resumeSimulationTime,
  getSimulationServiceDetails,
  getSimulationDates,
  getSimulationDetails,
  getSimulationSoftSkills,
  getPreviousAttemptSimulations
};
