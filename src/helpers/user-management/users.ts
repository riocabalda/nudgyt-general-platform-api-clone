import { PipelineStage } from 'mongoose';
import User from '../../models/user.model';
import naturalSort from '../../utils/natural-sort';
import { decryptFieldData, encryptFieldData } from '../db';

type UserManagementHelper = Awaited<
  ReturnType<typeof getUserManagementHelper>
>;

/**
 * Decrypt fields to support other functions
 *
 * Will not perform additional query unless conditions are satisfied!
 */
async function getUserManagementHelper(args: {
  enabled?: boolean;
  orgId: string;
  roles?: string[];
  search?: string;
  sortBy?: string;
}) {
  const { enabled = false } = args; // Toggle inefficient decryption
  const { orgId } = args;
  const { roles, search, sortBy } = args;

  if (!enabled) {
    return null;
  }

  const shouldGetDecryptionHelper =
    search || sortBy === 'name' || sortBy === 'full_name';
  if (!shouldGetDecryptionHelper) {
    return null;
  }

  const query: Record<string, unknown> = {
    'organizations.organization': orgId
  };

  const specifiedRoles = roles ?? [];
  if (specifiedRoles.length > 0) {
    query['organizations.roles'] = { $in: specifiedRoles };
  }

  const users = await User.find(query).lean();

  const decrypted = users.map((doc) => {
    return {
      _id: doc._id,
      full_name: decryptFieldData(doc.full_name),
      email: decryptFieldData(doc.email)
    };
  });

  return decrypted;
}

/**
 * Sort names in API side,
 * and use their associated IDs to sort in DB side
 */
function getSortByNameStages(args: {
  helper: NonNullable<UserManagementHelper>;
  additionalSort?: PipelineStage.Sort;
}) {
  const { helper, additionalSort } = args;

  const idsOfSortedNames = helper
    .sort((a, b) => naturalSort(a.full_name, b.full_name))
    .map((doc) => doc._id);

  const stages: PipelineStage[] = [
    {
      /** Add indices of sorted names */
      $addFields: {
        __index: {
          $indexOfArray: [idsOfSortedNames, '$_id']
        }
      }
    },
    {
      /** Sort by added indices */
      $sort: {
        ...additionalSort?.['$sort'],
        __index: 1
      }
    },
    {
      /** Remove added indices */
      $project: {
        __index: 0
      }
    }
  ];

  return stages;
}

/** Helper function to get sort stage based on field */
function getSortStages(args: {
  helper: UserManagementHelper;
  sortBy?: string;
}): PipelineStage[] {
  const { helper, sortBy } = args;

  if (sortBy === 'name' || sortBy === 'full_name') {
    if (helper === null) {
      return [
        /**
         * Sort by hash of full name
         *
         * Result is more or less random!
         */
        { $sort: { 'full_name.hash': 1 } }
      ];
    }

    return getSortByNameStages({ helper });
  }

  if (sortBy === 'created_at') {
    return [
      /** Sort by creation time */
      { $sort: { created_at: 1 } }
    ];
  }

  if (sortBy === 'status') {
    return []; // Will be sorted in memory
  }

  return [
    /** Sort by creation time */
    { $sort: { created_at: 1 } }
  ];
}

/** Get IDs of organizations whose names match the search string */
function getSearchMatchStage(args: {
  helper: UserManagementHelper;
  search: string;
}): PipelineStage.Match {
  const { helper, search } = args;

  if (helper === null) {
    const encryptedSearch = encryptFieldData(search);

    return {
      /** Hash-based matching requires exact search strings */
      $match: {
        $or: [
          { 'full_name.hash': encryptedSearch.hash },
          { 'email.hash': encryptedSearch.hash }
        ]
      }
    };
  }

  const searchRegex = new RegExp(search, 'i');
  const ids = helper
    .filter(
      (user) =>
        user.full_name.match(searchRegex) ||
        user.email.match(searchRegex)
    )
    .map((doc) => doc._id);

  return {
    $match: {
      _id: { $in: ids }
    }
  };
}

/**
 * Should be roughly equivalent to
 *
 * ```
 * User.populate('organizations.organization')
 * ```
 *
 */
function getPopulateUserMembershipsAsAggregationStages() {
  const stages: PipelineStage[] = [
    {
      /** Duplicate user document for each membership */
      $unwind: {
        path: '$organizations'
      }
    },
    {
      /** Populate memberships with organization info */
      $lookup: {
        from: 'organizations',
        localField: 'organizations.organization',
        foreignField: '_id',
        as: 'organizations.organization'
      }
    },
    {
      /**
       * Lookup result is an array, so simply get the first result
       *
       * Alternatively, can also unwind again
       *
       * Assuming the lookup result is only 1!
       */
      $set: {
        'organizations.organization': {
          $first: '$organizations.organization'
        }
      }
    },
    {
      /** Rebuild the unwounded user document */
      $group: {
        _id: '$_id',

        /** Revert the unwounded memberships back to an array */
        organizations: { $push: '$organizations' },

        /**
         * Rebuild the whole document
         *
         * Unfortunately needs to specify every single field
         * (that is wanted to be kept)
         */
        full_name: { $first: '$full_name' },
        email: { $first: '$email' },
        is_guest: { $first: '$is_guest' },
        pending_organizations: { $first: '$pending_organizations' },
        subscription: { $first: '$subscription' },
        archived_at: { $first: '$archived_at' },
        deleted_at: { $first: '$deleted_at' },
        email_verified_at: { $first: '$email_verified_at' },
        last_logged_in_at: { $first: '$last_logged_in_at' },
        created_at: { $first: '$created_at' },
        updated_at: { $first: '$updated_at' },

        /** Can exclude the following fields as a pseudo-projection process */
        __v: { $first: '$__v' },
        password: { $first: '$password' },
        verification_token: { $first: '$verification_token' }
      }
    }
  ];

  return stages;
}

const userManagement = {
  getUserManagementHelper,
  getSortStages,
  getSearchMatchStage,
  getPopulateUserMembershipsAsAggregationStages
};

export default userManagement;
