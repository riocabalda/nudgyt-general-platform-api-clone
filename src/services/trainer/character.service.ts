import createHttpError from 'http-errors';
import { escapeRegExp } from 'lodash';
import moment from 'moment-timezone';
import mongoose, { Types } from 'mongoose';
import z from 'zod';
import convaiConfig from '../../config/convai.config';
import { CharacterLogType } from '../../constants/logs';
import roles from '../../constants/roles';
import { decryptFieldData, encryptFieldData } from '../../helpers/db';
import { RequestAuth } from '../../middlewares/require-permissions';
import Avatar from '../../models/avatar.model';
import Character, { CharacterType } from '../../models/character.model';
import Organization from '../../models/organization.model';
import Service from '../../models/service.model';
import { UserType } from '../../models/user.model';
import { generatePrompt } from '../../utils/generate-character-backstory';
import { getOrgIdByOrgSlug } from '../../utils/get-org-id-by-org-slug';
import { CharacterValidationSchema } from '../../validations/admin/character.validation';
import logService from '../log.service';
import organizationService from '../organization.service';

async function getPaginatedCharacters({
  orgSlug,
  search,
  page = 1,
  limit = 10,
  filter = ''
}: {
  orgSlug: string;
  search: string;
  page: number;
  limit: number;
  filter: string;
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

  const filters = filter ? JSON.parse(filter) : { gender: [] };

  // Create base pipeline for both character queries
  const basePipeline = [
    {
      $match: {
        organization: organization._id,
        ...(search && { name: { $regex: search, $options: 'i' } })
      }
    },
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
    },
    {
      $match: {
        ...(filters.gender.length > 0 && {
          'avatar.gender': {
            $in: filters.gender.map(
              (gender: string) => new RegExp(`^${gender}$`, 'i')
            )
          }
        })
      }
    }
  ];

  // Execute queries in parallel
  const [characters, [totalCount]] = await Promise.all([
    Character.aggregate([
      ...basePipeline,
      {
        $sort: {
          name: 1,
          _id: 1
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
          from: 'services',
          localField: 'organization',
          foreignField: 'organization',
          as: 'services',
          let: { characterId: '$_id' },
          pipeline: [
            {
              $lookup: {
                from: 'service_levels',
                localField: 'basic_level',
                foreignField: '_id',
                as: 'basic_level',
                pipeline: [
                  {
                    $match: {
                      $expr: { $in: ['$$characterId', '$characters'] },
                      deleted_at: null
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
                let: {
                  characterId: '$$characterId',
                  multi_level: '$multi_level'
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $in: ['$_id', '$$multi_level'] },
                          { $in: ['$$characterId', '$characters'] },
                          { deleted_at: null }
                        ]
                      }
                    }
                  }
                ]
              }
            },
            {
              $match: {
                $or: [
                  { multi_level: { $ne: [] } },
                  { basic_level: { $exists: true } }
                ]
              }
            }
          ]
        }
      },
      {
        $unwind: {
          path: '$services',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$_id',
          services: { $push: '$services' },
          avatar: { $first: '$avatar' },
          name: { $first: '$name' },
          createdAt: { $first: '$created_at' },
          creator: { $first: '$creator' }
        }
      },
      {
        $sort: {
          name: 1,
          _id: 1
        }
      },
      { $skip: (page - 1) * limit },
      { $limit: limit }
    ]),
    Character.aggregate([...basePipeline, { $count: 'totalCount' }])
  ]);

  // Transform characters data
  const transformedCharacters = characters.map((character) => ({
    _id: character._id,
    name: character?.name,
    avatar: character?.avatar?.image_path,
    createdAt: moment(character.created_at).format(
      'MMMM D, YYYY h:mm A'
    ),
    createdBy: decryptFieldData(character?.creator?.full_name),
    services: character?.services.map((service: any) => service.title),
    serviceCount: character?.services.length
  }));

  const characterCount = totalCount?.totalCount || 0;

  const totalPages = Math.ceil(characterCount / limit);

  return {
    from: (page - 1) * limit + 1,
    to: Math.min(page * limit, characterCount),
    total: characterCount,
    prev: page > 1 ? page - 1 : undefined,
    next: page < totalPages ? page + 1 : undefined,
    current_page: page,
    data: transformedCharacters
  };
}

async function getCharacter({
  orgSlug,
  characterId
}: {
  orgSlug: string;
  characterId: string;
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

  await Avatar.findOne();

  // Execute character and services queries in parallel
  const [character, services] = await Promise.all([
    Character.findOne({
      _id: characterId,
      organization: organization._id
    })
      .populate('avatar')
      .populate('personality'),

    Service.aggregate([
      {
        $match: {
          organization: organization._id
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
      },
      {
        $sort: {
          'simulations.started_at': -1
        }
      },
      {
        $match: {
          deleted_at: null,
          $or: [
            {
              'basic_level.characters._id': new mongoose.Types.ObjectId(
                characterId
              )
            },
            {
              'multi_level.characters._id': new mongoose.Types.ObjectId(
                characterId
              )
            }
          ]
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
      }
    ])
  ]);

  if (!character) {
    throw createHttpError.Conflict('Character not found');
  }

  // Transform services data
  const relatedServices = services
    .map((service) => {
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
        title: service.title,
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
          type:
            service?.multi_level.length > 0 ? 'MULTI-LEVEL' : 'BASIC'
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
    })
    .filter(
      (service) =>
        service.basic_level?.characters?.length > 0 ||
        service.multi_level?.[0]?.characters?.length > 0
    );

  return {
    details: character,
    services: relatedServices
  };
}

async function updateCharacter({
  orgSlug,
  characterId,
  body,
  user,
  reqAuth
}: {
  orgSlug: string;
  characterId: string;
  body: z.infer<typeof CharacterValidationSchema>;
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!orgSlug) {
      throw createHttpError.Conflict('Organization Slug is required');
    }
    const orgSlugHash = encryptFieldData(orgSlug);

    const organization = await Organization.findOne({
      'slug.hash': orgSlugHash.hash
    }).session(session);

    if (!organization) {
      throw createHttpError.Conflict('Organization not found');
    }

    const character = await Character.findOne({
      organization: organization._id,
      _id: new mongoose.Types.ObjectId(characterId)
    }).session(session);

    if (!character) {
      throw createHttpError.Conflict('Character not found');
    }

    const updatedCharacter = await Character.findByIdAndUpdate(
      characterId,
      body,
      { new: true, session }
    );

    if (!updatedCharacter) {
      throw createHttpError.Conflict('Failed to update character');
    }

    const prompt = generatePrompt({
      name: updatedCharacter.name,
      age: updatedCharacter.age,
      languages: updatedCharacter.languages.join(', '),
      backstory: updatedCharacter.backstory,
      hiddenBackstory: updatedCharacter.hidden_backstory,
      personality: updatedCharacter.personality
    });

    const isConvaiUpdated = await updateConvaiCharacter({
      charID: updatedCharacter.personality_id,
      name: updatedCharacter.name,
      backstory: prompt,
      voiceType: updatedCharacter.voice_type
    });

    if (isConvaiUpdated !== 'SUCCESS') {
      throw new Error('Failed to update character in Convai');
    }

    /** Log action */
    const userFullName = decryptFieldData(user.full_name);
    const userOrgName = decryptFieldData(
      reqAuth.membership.organization.name
    );

    const characterName = updatedCharacter.name;

    await logService.createLog({
      organization: reqAuth.membership.organization._id,
      payload_snapshot: logService.encryptPayloadSnapshot({
        orgSlug,
        characterId,
        body: JSON.stringify(body)
      }),
      type: CharacterLogType.UPDATE,
      activity: encryptFieldData(
        `${userFullName} (${userOrgName} ${reqAuth.role}) updated character ${characterName}`
      )
    });

    await session.commitTransaction();

    return {
      name: updatedCharacter.name,
      age: updatedCharacter.age,
      languages: updatedCharacter.languages,
      voice_type: updatedCharacter.voice_type,
      backstory: updatedCharacter.backstory,
      hidden_backstory: updatedCharacter.hidden_backstory,
      personality: {
        openess: updatedCharacter.personality.openess,
        meticulousness: updatedCharacter.personality.meticulousness,
        extraversion: updatedCharacter.personality.extraversion,
        agreeableness: updatedCharacter.personality.agreeableness,
        sensitivity: updatedCharacter.personality.sensitivity,
        _id: updatedCharacter.personality_id
      }
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

async function getCharacters({
  search,
  orgSlug
}: {
  search?: string;
  orgSlug: string;
}) {
  let query = {};
  const andQueries = [];

  const userOrg = await organizationService.getOrganizationBySlug(
    orgSlug
  );

  if (userOrg) {
    andQueries.push({
      organization: userOrg._id
    });
  }

  if (search) {
    const escapedSearchString = escapeRegExp(search);
    const searchRegex = new RegExp(escapedSearchString, 'i');
    andQueries.push({
      name: { $regex: searchRegex }
    });
  }

  if (andQueries.length) {
    query = { $and: andQueries };
  }

  const characters = await Character.find(query).populate([
    'avatar',
    'organization'
  ]);

  return characters;
}

async function createCharacter({
  user,
  org,
  characterData,
  reqAuth
}: {
  user: UserType;
  org: string;
  characterData: CharacterType;
  reqAuth: RequestAuth;
}) {
  const prompt = generatePrompt({
    name: characterData.name,
    age: characterData.age,
    languages: characterData.languages.join(', '),
    backstory: characterData.backstory,
    hiddenBackstory: characterData.hidden_backstory,
    personality: characterData.personality
  });

  const personalityId = await createConvaiCharacter({
    name: characterData.name,
    backstory: prompt,
    voiceType: characterData.voice_type
  });

  if (!personalityId)
    throw createHttpError.InternalServerError(
      "Can't generate personality id"
    );

  characterData.personality_id = personalityId;
  characterData.creator = new Types.ObjectId(user._id);
  characterData.organization = getOrgIdByOrgSlug({
    user,
    org
  }) as Types.ObjectId;

  const newCharacter = await Character.create(characterData);

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const characterName = newCharacter.name;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      org,
      characterData: JSON.stringify(characterData)
    }),
    type: CharacterLogType.CREATE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) created character ${characterName}`
    )
  });

  return newCharacter;
}

async function createConvaiCharacter({
  name,
  backstory,
  voiceType
}: {
  name: string;
  backstory: string;
  voiceType: string;
}) {
  return await fetch(`${convaiConfig.convaiApiUrl}/character/create`, {
    method: 'POST',
    headers: {
      'CONVAI-API-KEY': convaiConfig.convaiApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      charName: name,
      voiceType,
      backstory
    })
  }).then(async (data) => {
    const response = (await data.json()) as unknown as {
      charID: string;
    };
    if ('charID' in response) {
      return response.charID;
    }
  });
}

async function updateConvaiCharacter({
  charID,
  name,
  backstory,
  voiceType
}: {
  charID: string;
  name?: string;
  backstory?: string;
  voiceType?: string;
}) {
  return await fetch(`${convaiConfig.convaiApiUrl}/character/update`, {
    method: 'POST',
    headers: {
      'CONVAI-API-KEY': convaiConfig.convaiApiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      charID,
      backstory,
      charName: name,
      voiceType
    })
  }).then(async (data) => {
    const response = (await data.json()) as {
      STATUS: string;
    };
    if ('STATUS' in response) {
      return response.STATUS;
    }
  });
}

export default {
  createCharacter,
  getCharacters,
  createConvaiCharacter,
  updateConvaiCharacter,
  getPaginatedCharacters,
  getCharacter,
  updateCharacter
};
