import mongoose from 'mongoose';
import messages from '../../constants/response-messages';
import decryptServiceData from '../../utils/decrypt-service-data';
import createHttpError from 'http-errors';
import Service from '../../models/service.model';
import {
  getSortQuery,
  SortOption,
  SortQuery
} from '../../utils/service-sort-keys';
import { withFromAndTo } from '../../utils/with-from-to';
import { UserType } from '../../models/user.model';
import { servicePopulate } from '../../utils/service-populate-query-builder';
import { customLabels } from '../../constants/pagination-custom-labels';
import { escapeRegExp } from 'lodash';
import Organization from '../../models/organization.model';
import { decryptFieldData, encryptFieldData } from '../../helpers/db';
import Simulation from '../../models/simulation.model';

async function getServices({
  orgSlug,
  user,
  search,
  sortBy,
  service_view,
  page = 1,
  limit = 9
}: {
  orgSlug?: string;
  user?: UserType;
  search?: string;
  service_view?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
} = {}) {
  let sort: SortQuery = { created_at: -1 };

  // Build the aggregation pipeline
  const pipeline: any[] = [];

  // Add a $match stage to filter services where deleted_at is null and is_published is true
  pipeline.push({
    $match: {
      deleted_at: { $eq: null },
      is_published: true
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

  // Add field for simulation count (needed for sorting) and last_paused_at
  // (last_paused_at only includes active simulations that:
  //  - are not ended (ended_at is null)
  //  - belong to the current user
  //  - are not trial data or have no is_trial_data field)
  pipeline.push({
    $addFields: {
      attempts_count: { $size: '$simulations' },
      last_paused_at: {
        $let: {
          vars: {
            active_simulations: {
              $filter: {
                input: '$simulations',
                as: 'sim',
                cond: {
                  $and: [
                    { $eq: ['$$sim.ended_at', null] },
                    { $eq: ['$$sim.learner', user?._id] },
                    {
                      $or: [
                        { $eq: ['$$sim.is_trial_data', false] },
                        {
                          $eq: [
                            { $type: '$$sim.is_trial_data' },
                            'missing'
                          ]
                        }
                      ]
                    }
                  ]
                }
              }
            }
          },
          in: {
            $arrayElemAt: [
              {
                $sortArray: {
                  input: {
                    $reduce: {
                      input: '$$active_simulations',
                      initialValue: [],
                      in: {
                        $concatArrays: ['$$value', '$$this.paused_at']
                      }
                    }
                  },
                  sortBy: -1
                }
              },
              0
            ]
          }
        }
      }
    }
  });

  // Handle filtering for services with attempts_count greater than 0 that are already simulated
  if (service_view === 'recent') {
    pipeline.push({
      $match: {
        $and: [
          { attempts_count: { $gt: 0 } },
          {
            simulations: {
              $elemMatch: {
                $or: [
                  { is_trial_data: false },
                  { is_trial_data: { $exists: false } }
                ]
              }
            }
          }
        ]
      }
    });

    // Add a field with the most recent started_at from simulations array
    pipeline.push({
      $addFields: {
        most_recent_simulation: {
          $max: '$simulations.started_at'
        }
      }
    });

    // Sort by the most recent simulation date
    sort = { most_recent_simulation: -1 };
  }

  // Handle filtering for services with attempts_count equal to 0 that are not yet simulated
  if (service_view === 'new') {
    pipeline.push({
      $match: {
        $or: [
          { attempts_count: 0 },
          {
            simulations: {
              $not: {
                $elemMatch: {
                  $or: [
                    { is_trial_data: false },
                    { is_trial_data: { $exists: false } }
                  ]
                }
              }
            }
          }
        ]
      }
    });

    sort = { created_at: -1 };
  }

  // Filter services that has saved simulation and sort by last_paused_at
  if (sortBy === 'saved_simulation') {
    pipeline.push({
      $match: {
        last_paused_at: { $exists: true, $ne: null }
      }
    });
    pipeline.push({
      $sort: { last_paused_at: -1 }
    });
  }

  // Handle search by title
  if (search) {
    const escapedSearchString = escapeRegExp(search);
    const searchRegex = new RegExp(escapedSearchString, 'i');
    pipeline.push({
      $match: { title: { $regex: searchRegex } }
    });
  }

  // Handle sorting
  if (sortBy) {
    sort = getSortQuery(sortBy as SortOption);
  }

  pipeline.push({ $sort: sort });

  // Excluded field
  pipeline.push({
    $project: {
      attempts_count: 0,
      most_recent_simulation: 0
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

async function getMostPopularServices({
  orgSlug
}: {
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

  const simulations = await Simulation.aggregate([
    {
      $lookup: {
        from: 'services',
        localField: 'service',
        foreignField: '_id',
        as: 'service',
        pipeline: [
          {
            $lookup: {
              from: 'users',
              localField: 'creator',
              foreignField: '_id',
              as: 'creator'
            }
          },
          {
            $unwind: '$creator'
          }
        ]
      }
    },
    {
      $unwind: '$service'
    },
    {
      $lookup: {
        from: 'service_levels',
        localField: 'service_level',
        foreignField: '_id',
        as: 'service_level',
        pipeline: [
          {
            $lookup: {
              from: 'characters',
              localField: 'character',
              foreignField: '_id',
              as: 'character',
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
                  $unwind: '$avatar'
                }
              ]
            }
          },
          {
            $unwind: '$character'
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
            $unwind: '$environment'
          }
        ]
      }
    },
    {
      $unwind: '$service_level'
    },
    {
      $match: {
        'service.organization': organization._id
      }
    },
    {
      $group: {
        _id: '$service._id',
        title: { $first: '$service.title' },
        description: { $first: '$service.description' },
        cover_image: { $first: '$service.cover_image' },
        creator_full_name: { $first: '$service.creator.full_name' },
        simulationCount: { $sum: 1 },
        lastSimulation: { $max: '$started_at' },
        character: {
          $first: {
            avatar: '$service_level.character.avatar.image_path',
            name: '$service_level.character.name',
            languages: '$service_level.character.languages'
          }
        },
        environment: {
          $first: {
            image: '$service_level.environment.image',
            location: '$service_level.environment.location',
            description: '$service_level.environment.description'
          }
        }
      }
    },
    {
      $sort: { simulationCount: -1 }
    }
  ]);

  return simulations.map((service) => ({
    serviceId: service._id,
    title: service.title,
    description: service.description,
    cover_image: service.cover_image,
    creator: decryptFieldData(service.creator_full_name),
    simulationCount: service.simulationCount,
    lastSimulation: service.lastSimulation,
    character: service.character,
    environment: service.environment
  }));
}

export default {
  getServices,
  getServiceById,
  getMostPopularServices
};
