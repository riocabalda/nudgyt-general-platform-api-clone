import createHttpError from 'http-errors';
import { escapeRegExp, flattenDeep, groupBy } from 'lodash';
import moment from 'moment-timezone';
import mongoose, { Types } from 'mongoose';
import { ServiceLogType } from '../../constants/logs';
import { customLabels } from '../../constants/pagination-custom-labels';
import messages from '../../constants/response-messages';
import roles from '../../constants/roles';
import { decryptFieldData, encryptFieldData } from '../../helpers/db';
import { uploadFile } from '../../helpers/uploads';
import { RequestAuth } from '../../middlewares/require-permissions';
import Character from '../../models/character.model';
import Environment from '../../models/environment.model';
import Organization from '../../models/organization.model';
import Rubric from '../../models/rubric.model';
import ServiceLevel, {
  ServiceLevelType
} from '../../models/service-level.model';
import ServiceType, {
  ServiceTypeEnum
} from '../../models/service-type.model';
import Service from '../../models/service.model';
import Simulation, {
  SimulationType
} from '../../models/simulation.model';
import Template from '../../models/template.model';
import User, { UserType } from '../../models/user.model';
import csvParser from '../../utils/csv-parser';
import decryptServiceData from '../../utils/decrypt-service-data';
import formatQuestions from '../../utils/format-questions';
import { generateLogDetails } from '../../utils/generate-log-details';
import { getOrgIdByOrgSlug } from '../../utils/get-org-id-by-org-slug';
import getPercentageMetric, {
  getLearnersScoreCount
} from '../../utils/get-percentage-metric';
import {
  getPeriodBetweenDates,
  isCurrentOrPreviousPeriod
} from '../../utils/get-period-between-dates';
import {
  convertMilliseconds,
  getDateRange,
  getSimulationUsedTime
} from '../../utils/metric-date-and-time-helpers';
import { servicePopulate } from '../../utils/service-populate-query-builder';
import {
  getSortQuery,
  SortOption,
  SortQuery
} from '../../utils/service-sort-keys';
import { getSimulationScore } from '../../utils/simulation';
import { withFromAndTo } from '../../utils/with-from-to';
import logService from '../log.service';

type Metric = {
  label: string;
  value: number | string;
  showTrend: boolean;
  change: number;
  isIncrease: boolean;
};

async function getServiceTypes() {
  const serviceTypes = await ServiceType.find();

  return serviceTypes;
}

async function createService({
  org,
  user,
  serviceLevelData,
  files,
  reqAuth
}: {
  org: string;
  user: UserType;
  serviceLevelData: Partial<
    ServiceLevelType & { service_type: string; template_id: string }
  >;
  files: {
    [fieldname: string]: Express.Multer.File[];
  };
  reqAuth: RequestAuth;
}) {
  const { environment, service_type, characters } = serviceLevelData;

  const STRING_NULL = 'null';
  let existingServiceType = undefined;
  const hasErrors: boolean[] = [];

  if (service_type && service_type.toString() !== STRING_NULL) {
    existingServiceType = await ServiceType.findById(service_type);
    if (!existingServiceType) hasErrors.push(true);
  }

  if (environment && environment.toString() !== STRING_NULL) {
    const existingEnvironment = await Environment.findById(environment);
    if (!existingEnvironment) hasErrors.push(true);
  } else {
    serviceLevelData.environment = undefined;
  }

  if (
    characters &&
    characters.toString() !== STRING_NULL &&
    characters.toString() !== ''
  ) {
    const characterIds = Array.isArray(characters)
      ? characters
      : (characters as string)
          .split(',')
          .filter((id) => id.trim())
          .map((id: string) => new Types.ObjectId(id.trim()));

    if (characterIds.length > 0) {
      const existingCharacters = await Character.find({
        _id: { $in: characterIds }
      });
      if (existingCharacters.length !== characterIds.length) {
        hasErrors.push(true);
      }
      serviceLevelData.characters = characterIds;
    } else {
      serviceLevelData.characters = [];
    }
  } else {
    serviceLevelData.characters = [];
  }

  if (hasErrors.some((isError) => isError)) {
    throw Error(messages.CHARACTER_ENVIRONMENT_SERVICE_TYPE_NOT_FOUND);
  }

  const fileTimestamp = Date.now();
  const fileUuid = crypto.randomUUID();

  let newFormatQuestions: any[] = [];
  let formQuestionsFileUrl: string | null = null;

  if (files.form_questions) {
    const formQuestionsFile = files.form_questions[0];

    const formQuestions = await csvParser(formQuestionsFile.buffer);

    const questionsBySection = groupBy(formQuestions, 'section');
    newFormatQuestions = formatQuestions(questionsBySection);

    formQuestionsFileUrl = await uploadFile({
      file: formQuestionsFile,
      keyPrefix: `services/${fileTimestamp}_${fileUuid}`,
      filenameType: 'keep'
    });
  }

  let newRubrics: any[] = [];

  if (files.rubrics) {
    const rubricsFile = files.rubrics[0];
    const rubrics = await csvParser(rubricsFile.buffer);
    newRubrics = rubrics;

    const rubricsFileUrl = await uploadFile({
      file: rubricsFile,
      keyPrefix: `services/${fileTimestamp}_${fileUuid}`,
      filenameType: 'keep'
    });

    const rubric = await Rubric.create({
      rubric_items: newRubrics,
      file: rubricsFileUrl
    });

    serviceLevelData.rubrics = rubric.id;
  }

  const template = await Template.findById(
    serviceLevelData.template_id
  );

  serviceLevelData.creator = user.id;
  serviceLevelData.form_questions = template
    ? template.form_questions
    : flattenDeep(newFormatQuestions);
  serviceLevelData.form_questions_file = formQuestionsFileUrl;

  const organizationId = getOrgIdByOrgSlug({
    user,
    org
  }) as Types.ObjectId;

  const newServiceLevel = await ServiceLevel.create(serviceLevelData);

  const newService = await Service.create({
    ...serviceLevelData,
    basic_level: newServiceLevel._id,
    organization: organizationId,
    template: serviceLevelData?.template_id
      ? new mongoose.Types.ObjectId(serviceLevelData.template_id)
      : null
  });

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const serviceName = serviceLevelData.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      data: JSON.stringify(serviceLevelData)
    }),
    type: ServiceLogType.CREATE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) created service ${serviceName}`
    )
  });

  return newService;
}

async function updateService({
  id,
  serviceLevelData,
  files,
  user,
  reqAuth
}: {
  id: string;
  serviceLevelData: Partial<
    ServiceLevelType & { service_type: string }
  >;
  files: {
    [fieldname: string]: Express.Multer.File[];
  };
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const existingService = await Service.findById(id);
  if (!existingService) {
    throw createHttpError.NotFound('Service not found');
  }

  const serviceLevel = await ServiceLevel.findById(
    existingService.basic_level
  );
  if (!serviceLevel) {
    throw createHttpError.NotFound('Service Level not found');
  }

  const { environment, service_type, characters } = serviceLevelData;

  const STRING_NULL = 'null';
  let existingEnvironment = undefined;
  let existingCharacters = undefined;
  let existingServiceType = undefined;
  const hasErrors: boolean[] = [];

  if (environment && environment.toString() !== STRING_NULL) {
    existingEnvironment = await Environment.findById(environment);
    if (!existingEnvironment) hasErrors.push(true);
  }

  if (service_type && service_type.toString() !== STRING_NULL) {
    existingServiceType = await ServiceType.findById(service_type);
    if (!existingServiceType) hasErrors.push(true);
  }

  if (characters) {
    const characterIds = Array.isArray(characters)
      ? characters.map((id) => new Types.ObjectId(id.toString()))
      : (characters as string)
          .split(',')
          .map((id: string) => new Types.ObjectId(id.trim()));

    existingCharacters = await Character.find({
      _id: { $in: characterIds }
    });

    if (existingCharacters.length !== characterIds.length) {
      hasErrors.push(true);
    }
    serviceLevelData.characters = characterIds;
  }

  const fileTimestamp = Date.now();
  const fileUuid = crypto.randomUUID();

  let newFormatQuestions: any[] = [];
  let formQuestionsFileUrl: string | null = null;

  if (files.form_questions) {
    const formQuestionsFile = files.form_questions[0];

    const formQuestions = await csvParser(formQuestionsFile.buffer);

    const questionsBySection = groupBy(formQuestions, 'section');
    newFormatQuestions = formatQuestions(questionsBySection);

    formQuestionsFileUrl = await uploadFile({
      file: formQuestionsFile,
      keyPrefix: `templates/${fileTimestamp}_${fileUuid}`,
      filenameType: 'keep'
    });
  }

  let newRubrics: any[] = [];

  if (files.rubrics) {
    const rubricsFile = files.rubrics[0];
    const rubrics = await csvParser(rubricsFile.buffer);
    newRubrics = rubrics;

    const rubricsFileUrl = await uploadFile({
      file: rubricsFile,
      keyPrefix: `templates/${fileTimestamp}_${fileUuid}`,
      filenameType: 'keep'
    });

    const existingRubricDoc = await Rubric.findById(
      serviceLevel.rubrics
    );
    if (existingRubricDoc !== null) {
      existingRubricDoc.rubric_items = newRubrics;
      existingRubricDoc.file = rubricsFileUrl;

      await existingRubricDoc.save();
    } else {
      const newRubricDoc = await Rubric.create({
        rubric_items: newRubrics,
        file: rubricsFileUrl
      });

      serviceLevelData.rubrics = newRubricDoc.id;
    }
  }

  if (hasErrors.some((isError) => isError)) {
    throw Error(messages.CHARACTER_ENVIRONMENT_SERVICE_TYPE_NOT_FOUND);
  }

  serviceLevel.set(serviceLevelData);
  serviceLevel.form_questions = flattenDeep(newFormatQuestions);
  serviceLevel.form_questions_file = formQuestionsFileUrl;

  existingService.service_type = service_type as any;

  await serviceLevel.save();
  await existingService.save();

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const serviceName = existingService.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      data: JSON.stringify(serviceLevelData)
    }),
    type: ServiceLogType.UPDATE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) updated service ${serviceName}`
    )
  });

  return existingService;
}

async function getServiceMetrics({
  orgSlug,
  timeFrame
}: {
  orgSlug: string;
  timeFrame:
    | 'seven-days'
    | 'today'
    | 'yesterday'
    | 'weekly'
    | 'monthly'
    | 'yearly';
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

  const { startDate, endDate } = getDateRange(timeFrame);

  const period = getPeriodBetweenDates(startDate, endDate);

  let periodLearnerServiceCount = {
    current: {
      totalServices: 0,
      totalLearner: [] as string[]
    },
    previous: {
      totalServices: 0,
      totalLearner: [] as string[]
    }
  };

  const learnersData = await User.find({
    'organizations.organization': organization._id,
    'organizations.roles': { $in: [roles.LEARNER] },
    approved_at: { $gte: period.previous.start }
  });

  for (const learner of learnersData) {
    /** Not sure if this is the right intention... */
    const memberships = learner.organizations ?? [];
    const membership = memberships.find(
      (membership) =>
        membership.organization.slug.hash === orgSlugHash.hash
    );

    const approveDate = membership?.approved_at ?? null;
    if (!approveDate) {
      continue;
    }

    const { isCurrentPeriod, isPreviousPeriod } =
      isCurrentOrPreviousPeriod(approveDate.toISOString(), period);

    if (isCurrentPeriod) {
      periodLearnerServiceCount.current.totalLearner.push(
        learner._id.toString()
      );
    }
    if (isPreviousPeriod) {
      periodLearnerServiceCount.previous.totalLearner.push(
        learner._id.toString()
      );
    }
  }

  const services = await Service.find({
    organization: organization._id,
    created_at: { $gte: period.previous.start }
  });

  for (const service of services) {
    const serviceData = service as any;
    if (serviceData._id && serviceData.created_at) {
      const { isCurrentPeriod, isPreviousPeriod } =
        isCurrentOrPreviousPeriod(
          serviceData.created_at.toISOString(),
          period
        );

      if (isCurrentPeriod) {
        periodLearnerServiceCount.current.totalServices += 1;
      }
      if (isPreviousPeriod) {
        periodLearnerServiceCount.previous.totalServices += 1;
      }
    }
  }

  const simulations = await Simulation.aggregate([
    {
      $match: {
        started_at: {
          $gte: new Date(period.current.start),
          $lte: new Date(period.current.end)
        },
        ended_at: { $ne: null }
      }
    },
    {
      $lookup: {
        from: 'services',
        localField: 'service',
        foreignField: '_id',
        as: 'service'
      }
    },
    { $unwind: { path: '$service' } },
    {
      $lookup: {
        from: 'service_levels',
        localField: 'service_level',
        foreignField: '_id',
        as: 'service_level'
      }
    },
    { $unwind: { path: '$service_level' } },
    { $match: { 'service.organization': organization._id } }
  ]);

  type TScoreDetails = {
    overall_total: number;
    overall_correct: number;
    overall_score: number;
  };
  const learnersScoreDetails: {
    current: Record<string, TScoreDetails>;
    previous: Record<string, TScoreDetails>;
  } = {
    current: {},
    previous: {}
  };

  const learners: string[] = [];
  const serviceLevelIds: string[] = [];
  let currentPeriodTotalLearners = 0;
  let previousPeriodTotalLearners = 0;

  for (const simulation of simulations) {
    const { ...OtherSimulation } = simulation;
    const { scores } = getSimulationScore(
      simulation.service_level,
      OtherSimulation
    );

    const {
      score: overall_correct,
      total: overall_total,
      percentage: overall_score
    } = scores.overall;

    const learnerId = simulation.learner.toString();
    const serviceLevelId = simulation.service_level._id.toString();
    const identifierId = `${learnerId}-${serviceLevelId}-${simulation._id}`;
    const startAt = simulation.started_at;
    const {
      isCurrentPeriod: isInsideCurrentPeriod,
      isPreviousPeriod: isInsidePreviousPeriod
    } = isCurrentOrPreviousPeriod(startAt.toISOString(), period);

    if (
      !learners.includes(
        `${learnerId}-current-${isInsideCurrentPeriod}`
      ) &&
      isInsideCurrentPeriod
    ) {
      learners.push(`${learnerId}-current-${isInsideCurrentPeriod}`);
      currentPeriodTotalLearners++;
    }

    // get the previous period leaners
    if (
      !learners.includes(
        `${learnerId}-prev-${isInsideCurrentPeriod}`
      ) &&
      isInsidePreviousPeriod
    ) {
      learners.push(`${learnerId}-prev-${isInsideCurrentPeriod}`);
      previousPeriodTotalLearners++;
    }

    // sum up all learners score to get the current period total score
    if (isInsideCurrentPeriod) {
      if (!serviceLevelIds.includes(serviceLevelId))
        serviceLevelIds.push(serviceLevelId);

      if (!(identifierId in learnersScoreDetails.current)) {
        learnersScoreDetails.current[identifierId] = {
          overall_correct,
          overall_total,
          overall_score
        };
      }
    }

    // sum up all learners get the previous period total score
    if (isInsidePreviousPeriod) {
      if (!(identifierId in learnersScoreDetails.previous)) {
        learnersScoreDetails.previous[identifierId] = {
          overall_correct,
          overall_total,
          overall_score
        };
      }
    }
  }

  const {
    count: currentCount,
    totalScore: currentTotalScore,
    totalPass: currentTotalPass
  } = getLearnersScoreCount(learnersScoreDetails, 'current');

  const {
    count: previousCount,
    totalScore: previousTotalScore,
    totalPass: previousTotalPass
  } = getLearnersScoreCount(learnersScoreDetails, 'previous');

  // get total passing rate (should at least 1 pass)
  const currentTotalPassingRate = currentCount
    ? (currentTotalPass / currentCount) * 100
    : 0;
  const previousTotalPassingRate = previousCount
    ? (previousTotalPass / previousCount) * 100
    : 0;
  const { percentage: passingRatePercentage, isUp: isUpPassingRate } =
    getPercentageMetric(
      currentTotalPassingRate,
      previousTotalPassingRate
    );

  const passingRate = {
    title: 'Total Passing Rate',
    value: Math.floor(currentTotalPassingRate),
    percentage: passingRatePercentage,
    is_up: isUpPassingRate,
    is_percentage: true
  };

  const currentAverageScore = currentTotalScore / currentCount;
  const previousAverageScore = previousTotalScore / previousCount;
  const { percentage: averageScorePercentage, isUp: averageScoreIsUp } =
    getPercentageMetric(currentAverageScore, previousAverageScore);

  const averageScore = {
    title: 'Average Score',
    value: Math.floor(currentAverageScore),
    percentage: averageScorePercentage,
    is_up: averageScoreIsUp,
    is_percentage: true
  };

  const {
    percentage: totalLearnersPercentage,
    isUp: totalLearnersIsUp
  } = getPercentageMetric(
    periodLearnerServiceCount.current.totalLearner.length,
    periodLearnerServiceCount.previous.totalLearner.length
  );

  const {
    percentage: totalServicesPercentage,
    isUp: totalServicesIsUp
  } = getPercentageMetric(
    periodLearnerServiceCount.current.totalServices,
    periodLearnerServiceCount.previous.totalServices
  );

  const metric: Metric[] = [
    {
      label: 'Total Learners',
      value: periodLearnerServiceCount.current.totalLearner.length,
      showTrend: true,
      change: totalLearnersPercentage,
      isIncrease: totalLearnersIsUp
    },
    {
      label: 'Total Passing Rate',
      value: passingRate.value + "%",
      showTrend: true,
      change: passingRate.percentage,
      isIncrease: passingRate.is_up
    },
    {
      label: 'Total Services',
      value: periodLearnerServiceCount.current.totalServices,
      showTrend: true,
      change: totalServicesPercentage,
      isIncrease: totalServicesIsUp
    },
    {
      label: 'Average Score',
      value: averageScore.value || 0,
      showTrend: true,
      change: averageScore.percentage,
      isIncrease: averageScore.is_up
    }
  ];

  return metric;
}

async function getPopularServices({ orgSlug }: { orgSlug: string }) {
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

  const services = await Service.aggregate([
    { $match: { organization: organization._id } },
    {
      $lookup: {
        from: 'simulations',
        localField: '_id',
        foreignField: 'service',
        as: 'simulations'
      }
    },
    {
      $match: {
        $or: [
          { 'simulations.is_trial_data': false },
          { 'simulations.is_trial_data': { $exists: false } }
        ]
      }
    },
    {
      $project: {
        _id: 1,
        title: 1,
        uniqueLearners: {
          $size: {
            $setUnion: '$simulations.learner'
          }
        }
      }
    },
    { $sort: { uniqueLearners: -1 } },
    { $limit: 4 }
  ]);

  return services.map((service) => ({
    service: service.title,
    totalLearners: service.uniqueLearners
  }));
}

async function getServicesStats({
  orgSlug,
  search,
  page,
  limit = 10 // Default limit for pagination
}: {
  orgSlug: string;
  search: string;
  page: number;
  limit?: number; // Optional limit parameter
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

  const services = await Service.aggregate([
    { $match: { organization: organization._id } },
    {
      $lookup: {
        from: 'simulations',
        localField: '_id',
        foreignField: 'service',
        as: 'simulations'
      }
    },
    {
      $unwind: {
        path: '$simulations',
        preserveNullAndEmptyArrays: true
      }
    }, // Step 1: Unwind simulations
    {
      $lookup: {
        from: 'users',
        localField: 'simulations.learner',
        foreignField: '_id',
        as: 'simulations.learner'
      }
    },
    {
      $unwind: {
        path: '$simulations.learner',
        preserveNullAndEmptyArrays: true
      }
    }, // Step 2: Unwind user details if needed
    {
      $lookup: {
        from: 'users',
        localField: 'creator',
        foreignField: '_id',
        as: 'creatorDetails'
      }
    },
    {
      $unwind: {
        path: '$creatorDetails',
        preserveNullAndEmptyArrays: true // This allows for cases where there may not be a creator
      }
    },
    {
      $group: {
        _id: '$_id',
        cover_image: { $first: '$cover_image' },
        title: { $first: '$title' },
        description: { $first: '$description' },
        simulations: { $push: '$simulations' }, // Step 3: Group simulations back into an array
        creatorDetails: { $first: '$creatorDetails' }
      }
    },
    ...(search
      ? [{ $match: { title: { $regex: search, $options: 'i' } } }]
      : []),
    {
      $project: {
        _id: 1,
        cover_image: 1,
        title: 1,
        description: 1,
        simulations: 1,
        creatorDetails: {
          _id: '$creatorDetails._id',
          full_name: '$creatorDetails.full_name',
          email: '$creatorDetails.email'
        }
      }
    },
    { $skip: (page - 1) * limit }, // Skip documents for pagination
    { $limit: limit } // Limit the number of documents returned
  ]);

  const modifiedServices: any[] = [];

  for (const service of services) {
    const totalUsageTime = service.simulations.reduce(
      (acc: number, simulation: SimulationType) => {
        return acc + getSimulationUsedTime(simulation);
      },
      0
    );

    const totalUsageTimeInHours = parseFloat(
      (convertMilliseconds(totalUsageTime).totalMinutes / 60).toFixed(2)
    );

    // Use a Set to count unique learners
    const uniqueLearners = new Set<string>();
    service.simulations.forEach((simulation: SimulationType) => {
      if (simulation.learner) {
        uniqueLearners.add(simulation.learner._id.toString()); // Assuming learner is an ObjectId
      }
    });
    const totalLearners = uniqueLearners.size; // Get the count of unique learners

    modifiedServices.push({
      service: service.title,
      totalUsageTime: totalUsageTimeInHours,
      totalLearners: totalLearners,
      createdAt: moment(service.created_at).format(
        'MMMM D, YYYY h:mm A'
      ),
      creator: decryptFieldData(service.creatorDetails.full_name)
    });
  }

  // Calculate total count of services
  const totalCount = await Service.countDocuments({
    organization: organization._id
  });

  // Calculate total pages
  const totalPages = Math.ceil(totalCount / limit);

  // New: Return paginated result in the desired format
  return {
    from: (page - 1) * limit + 1, // Calculate the starting index
    to: Math.min(page * limit, totalCount), // Calculate the ending index
    total: totalCount, // Total number of services
    prev_page: page > 1 ? page - 1 : undefined, // Previous page number
    next_page: page < totalPages ? page + 1 : undefined, // Next page number
    current_page: page, // Current page number
    data: modifiedServices // Return the modified services array
  };
}

async function getServices({
  orgSlug,
  user,
  search,
  sortBy,
  isPublished,
  userServices,
  page = 1,
  limit = 9
}: {
  orgSlug?: string;
  user?: UserType;
  search?: string;
  sortBy?: string;
  isPublished?: boolean;
  userServices?: boolean;
  page?: number;
  limit?: number;
} = {}) {
  let sort: SortQuery = { created_at: -1 };

  // Build the aggregation pipeline
  const pipeline: any[] = [];

  // Adds a $match stage to the pipeline to filter out services where deleted_at is not equal to null
  pipeline.push({
    $match: {
      deleted_at: { $eq: null }
    }
  });

  // Get Services by user organization
  if (user && user.organizations && user.organizations.length > 0) {
    const organizationIds = user.organizations.map(
      (org) => org.organization._id
    );

    pipeline.push({
      $match: {
        organization: { $in: organizationIds }
      }
    });
  }

  // populate reference fields
  pipeline.push(...servicePopulate());

  // Filter services that belong to the specified organization slug
  pipeline.push({
    $match: {
      'organization.slug.hash': {
        $eq: encryptFieldData(orgSlug as string).hash
      }
    }
  });

  // Perform a lookup to retrieve simulations related to the service
  // and use for sorting for most_attempts and least_attempts
  pipeline.push({
    $lookup: {
      from: 'simulations',
      localField: '_id',
      foreignField: 'service',
      as: 'simulations'
    }
  });

  // Add field for simulation count (needed for sorting)
  pipeline.push({
    $addFields: {
      attempts_count: { $size: '$simulations' }
    }
  });

  // Handle search by title
  if (search) {
    const escapedSearchString = escapeRegExp(search);
    const searchRegex = new RegExp(escapedSearchString, 'i');
    pipeline.push({
      $match: { title: { $regex: searchRegex } }
    });
  }

  // Filters based on published/draft status
  if (user) {
    pipeline.push({
      $match: {
        $or: [
          {
            // If still draft, keep only those by user
            $and: [{ is_published: false }, { 'creator._id': user._id }]
          },
          // If already published, keep all
          { is_published: true }
        ]
      }
    });
  }

  // Add stage to filter services based on userServices
  if (userServices && user) {
    pipeline.push({
      $match: {
        'creator._id': user._id
      }
    });
  }

  // Handle isPublished filter
  if (typeof isPublished !== 'undefined') {
    pipeline.push({
      $match: {
        is_published: isPublished
      }
    });

    // Add filter to match services where creator ID equals user ID
    if (user && user._id) {
      pipeline.push({
        $match: {
          'creator._id': user._id
        }
      });
    }
  }

  // Handle sorting
  if (sortBy) {
    sort = getSortQuery(sortBy as SortOption);
  }

  pipeline.push({ $sort: sort });

  // remove attempts_count and simulations field before returning
  pipeline.push({
    $project: {
      attempts_count: 0,
      simulations: 0
    }
  });

  // Create the aggregation
  const aggregation = Service.aggregate(pipeline);

  // Execute pagination
  let services = await Service.aggregatePaginate(aggregation, {
    page,
    limit,
    customLabels
  });

  if (Array.isArray(services.data)) {
    services.data = services.data.map((service: any) =>
      decryptServiceData(service)
    );
  }

  services = withFromAndTo(services);

  return services;
}

async function getServiceById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw Error(messages.INVALID_ID);
  }

  const populateServiceData = servicePopulate();

  // Create and execute the aggregation
  const [service] = await Service.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id) } },
    ...populateServiceData
  ]);

  if (!service) {
    throw createHttpError.NotFound(messages.SERVICE_NOT_FOUND);
  }

  // Decrypt sensitive data
  const decryptedService = decryptServiceData(service);

  return decryptedService;
}

async function validateAndFetchService(
  id: string,
  user: UserType,
  isPublished: boolean
) {
  const service = await Service.findById(id)
    .populate('service_type', 'basic_level')
    .populate({ path: 'multi_level' });

  if (!service) {
    throw createHttpError.NotFound(messages.SERVICE_NOT_FOUND);
  }

  if (service.creator._id.toString() !== user._id.toString()) {
    throw createHttpError.Forbidden(
      isPublished
        ? messages.PUBLISH_SERVICE_FORBIDDEN
        : messages.UNPUBLISH_SERVICE_FORBIDDEN
    );
  }

  const serviceLevel =
    service.service_type.type === ServiceTypeEnum.BASIC
      ? [service.basic_level]
      : service.multi_level;

  const isNotPublishable = serviceLevel?.some(
    (level: any) =>
      !level ||
      !('characters' in level) ||
      !('environment' in level) ||
      !level.characters?.length ||
      !level.environment ||
      !level.title?.trim() ||
      !level.description?.trim()
  );

  if (
    !service.title ||
    !service.description ||
    !service.creator ||
    !service.service_type ||
    isNotPublishable
  )
    throw createHttpError.BadRequest('Please add some data.');

  if (service.is_published === isPublished) {
    throw createHttpError.BadRequest(
      'The service is already in the desired state.'
    );
  }
  return service;
}

async function updatePublishFieldService({
  id,
  user,
  org,
  isPublished,
  reqAuth
}: {
  id: string;
  user: UserType;
  org: string;
  isPublished: boolean;
  reqAuth: RequestAuth;
}) {
  // Validate and fetch service
  const service = await validateAndFetchService(id, user, isPublished);

  await Service.findByIdAndUpdate(
    id,
    { is_published: isPublished },
    {
      new: true
    }
  );

  const actorUserFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const logCaseType = isPublished
    ? ServiceLogType.PUBLISH
    : ServiceLogType.UNPUBLISH;

  await logService.createLog({
    organization: getOrgIdByOrgSlug({ user, org }),
    payload_snapshot: logService.encryptPayloadSnapshot({
      actor_user_id: user._id
    }),
    type: logCaseType,
    activity: encryptFieldData(
      generateLogDetails({
        actor: `${actorUserFullName} (${userOrgName} ${reqAuth.role})`,
        target: `${service.title}`,
        type: logCaseType.toLowerCase()
      })
    )
  });
}

async function updateUnpublishFieldService({
  id,
  user,
  org,
  isPublished,
  reqAuth
}: {
  id: string;
  user: UserType;
  org: string;
  isPublished: boolean;
  reqAuth: RequestAuth;
}) {
  // Validate and fetch service
  const service = await validateAndFetchService(id, user, isPublished);

  await Service.findByIdAndUpdate(
    id,
    { is_published: isPublished },
    {
      new: true
    }
  );

  const actorUserFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const logCaseType = isPublished
    ? ServiceLogType.PUBLISH
    : ServiceLogType.UNPUBLISH;

  await logService.createLog({
    organization: getOrgIdByOrgSlug({ user, org }),
    payload_snapshot: logService.encryptPayloadSnapshot({
      actor_user_id: user._id
    }),
    type: logCaseType,
    activity: encryptFieldData(
      generateLogDetails({
        actor: `${actorUserFullName} (${userOrgName} ${reqAuth.role})`,
        target: `${service.title}`,
        type: logCaseType.toLowerCase()
      })
    )
  });
}

async function deleteService(
  id: string,
  user: UserType,
  org: string,
  reqAuth: RequestAuth
) {
  const service = await Service.findById(id)
    .populate('service_type', 'basic_level')
    .populate({ path: 'multi_level' });

  if (!service) {
    throw createHttpError.NotFound(messages.SERVICE_NOT_FOUND);
  }

  if (service.creator._id.toString() !== user._id.toString()) {
    throw createHttpError.Forbidden(messages.DELETE_SERVICE_FORBIDDEN);
  }

  // Soft delete the service by setting the deleted_at field to the current timestamp
  await Service.findByIdAndUpdate(
    { _id: id },
    { deleted_at: Date.now() }
  );

  const actorUserFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: getOrgIdByOrgSlug({ user, org }),
    payload_snapshot: logService.encryptPayloadSnapshot({
      actor_user_id: user._id
    }),
    type: ServiceLogType.DELETE,
    activity: encryptFieldData(
      generateLogDetails({
        actor: `${actorUserFullName} (${userOrgName} ${reqAuth.role})`,
        target: `${service.title}`,
        type: 'deleted service'
      })
    )
  });
}

async function getRecentServices({
  orgSlug,
  search,
  page,
  limit,
  isRecent
}: {
  orgSlug: string;
  search: string;
  page: number;
  limit: number;
  isRecent: boolean;
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

  const baseQuery = [
    {
      $match: {
        organization: organization._id,

        ...(search ? { title: { $regex: search, $options: 'i' } } : {})
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'creator',
        foreignField: '_id',
        as: 'creator'
      }
    },
    {
      $unwind: {
        path: '$creator',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'service_types',
        localField: 'service_type',
        foreignField: '_id',
        as: 'service_type'
      }
    },
    {
      $unwind: {
        path: '$service_type',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'service_levels',
        localField: 'basic_level',
        foreignField: '_id',
        as: 'basic_level',
        pipeline: [
          {
            $lookup: {
              from: 'characters',
              localField: 'characters',
              foreignField: '_id',
              as: 'characters',
              pipeline: [
                {
                  $lookup: {
                    from: 'avatars',
                    localField: 'avatar',
                    foreignField: '_id',
                    as: 'avatar'
                  }
                },
                {
                  $unwind: {
                    path: '$avatar',
                    preserveNullAndEmptyArrays: true
                  }
                }
              ]
            }
          },
          {
            $lookup: {
              from: 'environments',
              localField: 'environment',
              foreignField: '_id',
              as: 'environment'
            }
          },
          {
            $unwind: {
              path: '$environment',
              preserveNullAndEmptyArrays: true
            }
          }
        ]
      }
    },
    {
      $unwind: {
        path: '$basic_level',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'service_levels',
        localField: 'multi_level',
        foreignField: '_id',
        as: 'multi_level',
        pipeline: [
          {
            $lookup: {
              from: 'characters',
              localField: 'characters',
              foreignField: '_id',
              as: 'characters',
              pipeline: [
                {
                  $lookup: {
                    from: 'avatars',
                    localField: 'avatar',
                    foreignField: '_id',
                    as: 'avatar'
                  }
                },
                {
                  $unwind: {
                    path: '$avatar',
                    preserveNullAndEmptyArrays: true
                  }
                }
              ]
            }
          },
          {
            $lookup: {
              from: 'environments',
              localField: 'environment',
              foreignField: '_id',
              as: 'environment'
            }
          },
          {
            $unwind: {
              path: '$environment',
              preserveNullAndEmptyArrays: true
            }
          }
        ]
      }
    },
    {
      $lookup: {
        from: 'simulations',
        localField: '_id',
        foreignField: 'service',
        as: 'simulations'
      }
    },
    {
      $unwind: {
        path: '$simulations',
        preserveNullAndEmptyArrays: true
      }
    }
  ];

  const services = await Service.aggregate([
    ...baseQuery,
    // Sort by the latest simulation's started_at date
    {
      $sort: {
        created_at: -1 // Secondary sort for services without simulations
      }
    },
    {
      $group: {
        _id: '$_id',
        title: { $first: '$title' },
        cover_image: { $first: '$cover_image' },
        description: { $first: '$description' },
        service_type: { $first: '$service_type' },
        multi_level: { $first: '$multi_level' },
        basic_level: { $first: '$basic_level' },
        latestSimulation: { $first: '$simulations' },
        created_at: { $first: '$created_at' },
        creator: { $first: '$creator' }
      }
    },
    { $skip: (page - 1) * limit },
    { $limit: limit }
  ]);

  const countResult = await Service.aggregate([
    ...baseQuery,
    // Sort by the latest simulation's started_at date
    {
      $sort: {
        created_at: -1 // Secondary sort for services without simulations
      }
    },
    {
      $group: {
        _id: '$_id',
        title: { $first: '$title' },
        cover_image: { $first: '$cover_image' },
        description: { $first: '$description' },
        service_type: { $first: '$service_type' },
        multi_level: { $first: '$multi_level' },
        basic_level: { $first: '$basic_level' },
        latestSimulation: { $first: '$simulations' },
        created_at: { $first: '$created_at' },
        creator: { $first: '$creator' }
      }
    },
    { $count: 'total' }
  ]);

  const totalCount = countResult.length > 0 ? countResult[0].total : 0;

  const customServices = services.map((service) => {
    const multi_level = service?.multi_level[0];
    const creator = {
      full_name: decryptFieldData(service.creator.full_name),
      organization: organization.name,
      user_type: service.creator.organizations.some((org: any) =>
        org.roles.includes(roles.ADMIN)
      )
        ? 'Admin'
        : 'Learner'
    };
    const isPublishedByServiceType =
      service?.multi_level.length > 0
        ? multi_level?.is_published
        : service?.basic_level.is_published;
    return {
      id: service._id,
      is_published: isPublishedByServiceType,
      title:
        service?.multi_level.length > 0
          ? service.title
          : service.basic_level.title,
      basic_level: !service?.multi_level.length
        ? {
            title: service.basic_level.title,
            description: service.basic_level.description,
            environment: service.basic_level.environment,
            is_published: service.basic_level.is_published,
            characters: service.basic_level.characters,
            creator
          }
        : null,

      multi_level:
        service?.multi_level.length > 0
          ? [
              {
                title: service.title,
                description: service.description,
                environment: service.cover_image,
                is_published: multi_level?.is_published,
                characters: multi_level?.characters,
                creator
              }
            ]
          : null,
      service_type: {
        type: service?.multi_level.length > 0 ? 'MULTI-LEVEL' : 'BASIC'
      },
      creator,
      start_at: service.latestSimulation?.started_at,
      end_at: service.latestSimulation?.ended_at,
      last_paused_at: service.latestSimulation
        ? moment(
            Math.max(
              ...service.latestSimulation.paused_at.map((sim: any) =>
                new Date(sim).getTime()
              )
            )
          ).format('MMMM D, YYYY h:mm A')
        : null,
      created_at: service.created_at
    };
  });

  // New: Calculate total pages
  const totalPages = Math.ceil(totalCount / limit);

  // New: Return paginated result in the desired format
  return {
    from: (page - 1) * limit + 1, // Calculate the starting index
    to: Math.min(page * limit, totalCount), // Calculate the ending index
    total: totalCount, // Total number of services
    prev_page: page > 1 ? page - 1 : undefined, // Previous page number
    next_page: page < totalPages ? page + 1 : undefined, // Next page number
    current_page: page, // Current page number
    data: customServices // Return the services array
  };
}

async function getServiceLearnersScores(serviceId: string) {
  const simulations = await Simulation.aggregate([
    {
      $match: {
        service: new mongoose.Types.ObjectId(serviceId),
        // Only get completed simulations
        ended_at: { $ne: null },
        $or: [
          { is_trial_data: false },
          { is_trial_data: { $exists: false } }
        ]
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: 'learner',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: '$user'
    },
    {
      $lookup: {
        from: 'services',
        localField: 'service',
        foreignField: '_id',
        as: 'service'
      }
    },
    {
      $unwind: '$service'
    },
    {
      $lookup: {
        from: 'service_levels',
        localField: 'service.basic_level',
        foreignField: '_id',
        as: 'service.basic_level'
      }
    },
    {
      $unwind: {
        path: '$service.basic_level',
        preserveNullAndEmptyArrays: true
      }
    }
  ]);

  const scores = [];

  for (const simulation of simulations) {
    const { service, user, ...otherDetails } = simulation;
    const scoreDetails = getSimulationScore(
      service.basic_level,
      simulation
    );

    if (scoreDetails?.scores?.overall) {
      scores.push({
        best_score: scoreDetails.scores.overall.percentage,
        simulation_id: otherDetails._id,
        user: {
          _id: user._id,
          full_name: decryptFieldData(user.full_name)
        }
      });
    }
  }

  const bestScores = scores
    .sort((a, b) => b.best_score - a.best_score)
    .reduce((acc, curr) => {
      if (!(curr.user._id in acc)) {
        acc[curr.user._id] = curr;
      }
      return acc;
    }, {} as Record<string, any>);

  return Object.values(bestScores);
}

export default {
  getServiceMetrics,
  getPopularServices,
  getServicesStats,
  getServices,
  getServiceById,
  updatePublishFieldService,
  updateUnpublishFieldService,
  deleteService,
  getRecentServices,
  getServiceLearnersScores,
  getServiceTypes,
  createService,
  updateService
};
