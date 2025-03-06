const populateBasicLevel = [
  {
    $lookup: {
      from: 'service_levels',
      localField: 'basic_level',
      foreignField: '_id',
      as: 'basic_level'
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
      from: 'characters',
      localField: 'basic_level.characters',
      foreignField: '_id',
      as: 'basic_level.characters',
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
      from: 'users',
      localField: 'basic_level.creator',
      foreignField: '_id',
      as: 'basic_level.creator'
    }
  },
  {
    $addFields: {
      'basic_level.creator': {
        $arrayElemAt: ['$basic_level.creator', 0]
      }
    }
  },
  {
    $lookup: {
      from: 'environments',
      localField: 'basic_level.environment',
      foreignField: '_id',
      as: 'basic_level.environment'
    }
  },
  {
    $addFields: {
      'basic_level.environment': {
        $arrayElemAt: ['$basic_level.environment', 0]
      }
    }
  },
  {
    $lookup: {
      from: 'rubrics',
      localField: 'basic_level.rubrics',
      foreignField: '_id',
      as: 'basic_level.rubrics'
    }
  },
  {
    $addFields: {
      'basic_level.rubrics': {
        $arrayElemAt: ['$basic_level.rubrics', 0]
      }
    }
  }
];

const populateMultiLevel = [
  {
    $lookup: {
      from: 'service_levels',
      localField: 'multi_level',
      foreignField: '_id',
      as: 'multi_level'
    }
  },
  {
    $lookup: {
      from: 'characters',
      localField: 'multi_level.characters',
      foreignField: '_id',
      as: 'populated_characters',
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
      from: 'users',
      localField: 'multi_level.creator',
      foreignField: '_id',
      as: 'populated_creators'
    }
  },
  {
    $lookup: {
      from: 'environments',
      localField: 'multi_level.environment',
      foreignField: '_id',
      as: 'populated_environments'
    }
  },
  {
    $addFields: {
      multi_level: {
        $map: {
          input: '$multi_level',
          as: 'level',
          in: {
            $mergeObjects: [
              '$$level',
              {
                characters: {
                  $filter: {
                    input: '$populated_characters',
                    cond: {
                      $in: ['$$this._id', '$$level.characters']
                    }
                  }
                },
                creator: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$populated_creators',
                        cond: { $eq: ['$$this._id', '$$level.creator'] }
                      }
                    },
                    0
                  ]
                },
                environment: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$populated_environments',
                        cond: {
                          $eq: ['$$this._id', '$$level.environment']
                        }
                      }
                    },
                    0
                  ]
                },
                rubric: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: '$populated_rubrics',
                        cond: {
                          $eq: ['$$this._id', '$$level.rubrics']
                        }
                      }
                    },
                    0
                  ]
                }
              }
            ]
          }
        }
      }
    }
  },
  {
    $project: {
      populated_characters: 0,
      populated_creators: 0,
      populated_environments: 0
    }
  }
];

const populateCreator = [
  // populate creator and creator's organization array while retaining all other fields in the array.
  {
    $lookup: {
      from: 'users',
      localField: 'creator',
      foreignField: '_id',
      as: 'creator',
      pipeline: [
        {
          $lookup: {
            from: 'organizations',
            localField: 'organizations.organization',
            foreignField: '_id',
            as: 'populated_organizations'
          }
        },
        {
          $addFields: {
            organizations: {
              $map: {
                input: '$organizations',
                as: 'org',
                in: {
                  $mergeObjects: [
                    '$$org',
                    {
                      organization: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$populated_organizations',
                              cond: {
                                $eq: [
                                  '$$this._id',
                                  '$$org.organization'
                                ]
                              }
                            }
                          },
                          0
                        ]
                      }
                    }
                  ]
                }
              }
            }
          }
        },
        {
          $project: {
            populated_organizations: 0
          }
        }
      ]
    }
  }, // Unwind the arrays created by $lookup to convert them to objects
  { $unwind: { path: '$creator', preserveNullAndEmptyArrays: true } }
];

export const servicePopulate = () => {
  const pipeline = [];

  // populate reference fields
  pipeline.push(
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
        from: 'organizations',
        localField: 'organization',
        foreignField: '_id',
        as: 'organization'
      }
    },
    {
      $unwind: {
        path: '$organization',
        preserveNullAndEmptyArrays: true
      }
    }
  );

  return [
    ...pipeline,
    ...populateCreator,
    ...populateBasicLevel,
    ...populateMultiLevel
  ];
};
