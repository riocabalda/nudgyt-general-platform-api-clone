import createHttpError from 'http-errors';
import moment from 'moment-timezone';
import mongoose from 'mongoose';
import organizationConfig from '../../config/organization.config';
import roles from '../../constants/roles';
import { decryptFieldData, encryptFieldData } from '../../helpers/db';
import { RequestAuth } from '../../middlewares/require-permissions';
import Organization from '../../models/organization.model';
import Service, { ServiceType } from '../../models/service.model';
import Simulation, {
  SimulationType
} from '../../models/simulation.model';
import Subscription from '../../models/subscription.model';
import User from '../../models/user.model';
import { calculateLearnerExperience } from '../../utils/learner-experience';
import {
  convertMilliseconds,
  getSimulationUsedTime
} from '../../utils/metric-date-and-time-helpers';

async function getAccess(args: { reqAuth: RequestAuth }) {
  const { reqAuth } = args;

  const encryptedPublicOrgName = encryptFieldData(
    organizationConfig.PUBLIC_ORGANIZATION_NAME
  );

  const isPublicMember =
    reqAuth.membership.organization.name.hash ===
    encryptedPublicOrgName.hash;
  if (isPublicMember) {
    return {
      access: 'public',
      features_html: []
    };
  }

  const subscriptionId = reqAuth.membership.organization.subscription;
  const subscription = await Subscription.findById(subscriptionId)
    .populate('subscription_plan')
    .lean();
  if (subscription === null) {
    throw createHttpError.NotFound('Subscription not found');
  }

  const plan: any = subscription.subscription_plan;

  return {
    access: 'organization',
    features_html: plan.features_html,
    price: plan.price,
    currency: plan.currency
  };
}

async function getLearnerStats({
  orgSlug,
  search,
  page,
  limit = 10
}: {
  orgSlug: string;
  search?: string;
  page: number;
  limit?: number;
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

  let hashSearch = '';

  if (search) {
    const { hash } = encryptFieldData(search);
    hashSearch = hash;
  }

  const users = await User.aggregate([
    {
      $match: {
        'organizations.organization': organization._id,
        'organizations.roles': { $in: [roles.LEARNER] },
        $or: [
          { 'full_name.hash': { $regex: hashSearch, $options: 'i' } },
          { email: { $regex: hashSearch, $options: 'i' } }
        ]
      }
    },
    {
      $lookup: {
        from: 'simulations',
        localField: '_id',
        foreignField: 'learner',
        as: 'simulations'
      }
    },
    {
      $unwind: {
        path: '$simulations',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $lookup: {
        from: 'services',
        localField: 'simulations.service',
        foreignField: '_id',
        as: 'serviceDetails',
        pipeline: [
          {
            $match: {
              organization: organization._id
            }
          }
        ]
      }
    },
    {
      $unwind: {
        path: '$serviceDetails',
        preserveNullAndEmptyArrays: true
      }
    },

    {
      $group: {
        _id: '$_id',
        full_name: { $first: '$full_name' },
        email: { $first: '$email' },
        simulations: {
          $push: {
            simulation: '$simulations',
            service: '$serviceDetails'
          }
        }
      }
    }
  ]);

  const learners: any[] = [];

  for (const user of users) {
    let usageHours = 0;
    let recentUsedService: { service: ServiceType } | null = null;
    let services: string[] = [];

    if (user.simulations.length > 0) {
      usageHours = user.simulations.reduce(
        (acc: number, data: { simulation: SimulationType }) => {
          return (
            acc +
            (data?.simulation?.started_at
              ? getSimulationUsedTime(data?.simulation)
              : 0)
          );
        },
        0
      );

      recentUsedService = user.simulations.sort(
        (
          a: { simulation: SimulationType },
          b: { simulation: SimulationType }
        ) =>
          (b.simulation.started_at
            ? new Date(b.simulation.started_at).getTime()
            : 0) -
          (a.simulation.started_at
            ? new Date(a.simulation.started_at).getTime()
            : 0)
      )[0];

      services = Array.from(
        new Set(
          user.simulations.map(
            (simulation: { service: ServiceType }) =>
              simulation?.service?.title
          )
        )
      );
    }

    const totalUsageTimeInHours = parseFloat(
      (convertMilliseconds(usageHours).totalMinutes / 60).toFixed(2)
    );

    const decryptedFullName = decryptFieldData(user.full_name);
    const decryptedEmail = decryptFieldData(user.email);

    learners.push({
      fullName: decryptedFullName,
      email: decryptedEmail,
      joinedDate: moment(user.created_at).format('MMMM D, YYYY'),
      usageHours: totalUsageTimeInHours,
      services: services,
      recentUsedService: recentUsedService?.service?.title
    });
  }

  const totalCount = await User.countDocuments({
    'organizations.organization': organization._id,
    'organizations.roles': { $in: [roles.LEARNER] }
  });

  const totalPages = Math.ceil(totalCount / limit);

  return {
    from: (page - 1) * limit + 1,
    to: Math.min(page * limit, totalCount),
    total: totalCount,
    prev_page: page > 1 ? page - 1 : undefined,
    next_page: page < totalPages ? page + 1 : undefined,
    current_page: page,
    data: learners
  };
}

async function getUserRecentServices({
  userId,
  orgSlug
}: {
  userId: string;
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

  const user = await User.findById(userId);

  if (!user) {
    throw createHttpError.NotFound('User not found');
  }

  const userTypeByOrganization = user?.organizations?.find(
    (org: any) =>
      org.organization._id.toString() === organization._id.toString()
  )?.roles[0];

  let selectedServices: any[] = [];
  let serviceCount = 0;
  if (userTypeByOrganization === roles.LEARNER) {
    const baseQuery = [
      {
        $match: {
          learner: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $lookup: {
          from: 'services',
          localField: 'service',
          foreignField: '_id',
          as: 'service',
          pipeline: [
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
            }
          ]
        }
      },
      {
        $unwind: {
          path: '$service',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $lookup: {
          from: 'service_levels',
          localField: 'service_level',
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
      }
    ];
    const servicesCount = await Simulation.aggregate([
      ...baseQuery,
      {
        $addFields: {
          lastActivity: '$ended_at'
        }
      },
      {
        $match: {
          lastActivity: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$service._id',
          service: { $first: '$service' },
          basic_level: { $first: '$basic_level' },
          lastActivity: { $max: '$lastActivity' },
          started_at: { $max: '$started_at' },
          ended_at: { $max: '$ended_at' },
          paused_at: { $max: '$paused_at' }
        }
      }
    ]);

    const simulations = await Simulation.aggregate([
      ...baseQuery,
      {
        $addFields: {
          lastActivity: {
            $cond: {
              if: { $gt: [{ $size: '$paused_at' }, 0] },
              then: { $arrayElemAt: ['$paused_at', -1] },
              else: '$ended_at'
            }
          }
        }
      },
      {
        $match: {
          lastActivity: { $ne: null }
        }
      },
      {
        $sort: {
          lastActivity: -1
        }
      },
      {
        $group: {
          _id: '$service._id',
          service: { $first: '$service' },
          basic_level: { $first: '$basic_level' },
          lastActivity: { $max: '$lastActivity' },
          started_at: { $max: '$started_at' },
          ended_at: { $max: '$ended_at' },
          paused_at: { $max: '$paused_at' }
        }
      },
      {
        $sort: {
          lastActivity: -1
        }
      },
      {
        $limit: 9
      }
    ]);

    const services = simulations.map((sim) => {
      const creator = {
        full_name: decryptFieldData(sim.service.creator.full_name),

        organization: sim.service.organization.name,
        user_type: sim.service.creator.organizations.some((org: any) =>
          org.roles.includes(roles.ADMIN)
        )
          ? 'Admin'
          : 'Learner'
      };
      return {
        id: sim.service._id,
        is_published: sim.service.is_published,
        title: sim.service.title,
        basic_level:
          sim.service.service_type.type === 'BASIC'
            ? {
                title: sim.basic_level.title,
                description: sim.basic_level.description,
                environment: sim.basic_level.environment,
                is_published: sim.basic_level.is_published,
                characters: sim.basic_level.characters,
                creator
              }
            : null,
        multi_level:
          sim.service.service_type.type === 'MULTI-LEVEL'
            ? [
                {
                  title: sim.service.title,
                  description: sim.service.description,
                  environment: sim.service.cover_image,
                  is_published: sim.service.is_published,
                  characters: sim.service.multi_level[0].characters,
                  creator
                }
              ]
            : null,
        service_type: {
          type:
            sim.service.service_type.type === 'MULTI-LEVEL'
              ? 'MULTI-LEVEL'
              : 'BASIC'
        },
        creator,
        start_at: sim.started_at,
        end_at: sim.ended_at,
        last_paused_at: sim.lastActivity
      };
    });

    selectedServices = services;
    serviceCount = servicesCount.length;
  } else if (
    userTypeByOrganization === roles.TRAINER ||
    userTypeByOrganization === roles.ADMIN
  ) {
    const baseQuery = [
      {
        $match: {
          creator: new mongoose.Types.ObjectId(
            '67870358025882e1d3afdcf4'
          ),
          organization: new mongoose.Types.ObjectId(
            '67870162025882e1d3afdc17'
          )
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
      }
    ];
    const userTrainerServices = await Service.aggregate([
      ...baseQuery,
      {
        $sort: {
          created_at: -1
        }
      },
      {
        $limit: 9
      }
    ]);

    const servicesCount = await Service.countDocuments({
      creator: new mongoose.Types.ObjectId('67870358025882e1d3afdcf4'),
      organization: new mongoose.Types.ObjectId(
        '67870162025882e1d3afdc17'
      )
    });

    const services = userTrainerServices.map((service) => {
      const creator = {
        full_name: decryptFieldData(service.creator.full_name),
        user_type: service.creator.organizations.some((org: any) =>
          org.roles.includes(roles.ADMIN)
        )
          ? 'Admin'
          : 'Trainer'
      };
      return {
        id: service._id,
        is_published: service.is_published,
        title: service.title,
        basic_level:
          service.service_type.type === 'BASIC'
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
          service.service_type.type === 'MULTI-LEVEL'
            ? [
                {
                  title: service.title,
                  description: service.description,
                  environment: service.cover_image,
                  is_published: service.is_published,
                  characters: service.multi_level[0].characters,
                  creator
                }
              ]
            : null,
        service_type: {
          type:
            service.service_type.type === 'MULTI-LEVEL'
              ? 'MULTI-LEVEL'
              : 'BASIC'
        },
        creator,
        start_at: service.created_at,
        end_at: service.created_at,
        last_paused_at: service.created_at
      };
    });

    selectedServices = services;
    serviceCount = servicesCount;
  }

  return {
    services: selectedServices,
    userType: userTypeByOrganization?.toLowerCase(),
    serviceCount: serviceCount
  };
}

const getLearnerExperience = async ({
  learner,
  orgSlug
}: {
  learner: string;
  orgSlug: string;
}) => {
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

  const learnerExperience = await calculateLearnerExperience({
    learner,
    organization: organization._id.toString()
  });

  const sampleData = {
    isFromLearner: true,
    ...learnerExperience
  };

  return sampleData;
};

export default {
  getAccess,
  getLearnerStats,
  getUserRecentServices,
  getLearnerExperience
};
