import { PipelineStage } from 'mongoose';
import Organization from '../../models/organization.model';
import naturalSort from '../../utils/natural-sort';
import { decryptFieldData, encryptFieldData } from '../db';

type OrganizationManagementHelper = Awaited<
  ReturnType<typeof getOrganizationManagementHelper>
>;

/**
 * Decrypt fields to support other functions
 *
 * Will not perform additional query unless conditions are satisfied!
 */
async function getOrganizationManagementHelper(args: {
  enabled?: boolean;
  search?: string;
  sortBy?: string;
}) {
  const { enabled = false } = args; // Toggle inefficient decryption
  const { search, sortBy } = args;

  if (!enabled) {
    return null;
  }

  const shouldGetDecryptionHelper =
    search || sortBy === 'name' || sortBy === 'status';
  if (!shouldGetDecryptionHelper) {
    return null;
  }

  const orgNames = await Organization.find({})
    .select('_id name')
    .lean();

  const decrypted = orgNames.map((doc) => ({
    _id: doc._id,
    decryptedName: decryptFieldData(doc.name)
  }));

  return decrypted;
}

/**
 * Sort names in API side,
 * and use their associated IDs to sort in DB side
 */
function getSortByNameStages(args: {
  helper: NonNullable<OrganizationManagementHelper>;
  additionalSort?: PipelineStage.Sort;
}) {
  const { helper, additionalSort } = args;

  const idsOfSortedNames = helper
    .sort((a, b) => naturalSort(a.decryptedName, b.decryptedName))
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
  helper: OrganizationManagementHelper;
  sortBy: string;
}): PipelineStage[] {
  const { helper, sortBy } = args;

  if (sortBy === 'name') {
    if (helper === null) {
      return [
        /**
         * Sort by hash of name
         *
         * Result is more or less random!
         */
        { $sort: { 'name.hash': 1 } }
      ];
    }

    return getSortByNameStages({ helper });
  }

  if (sortBy === 'status') {
    const sortStage: PipelineStage.Sort = {
      $sort: {
        status: 1,
        suspended_at: 1
      }
    };

    if (helper === null) {
      /** Sort by status fields as-is */
      return [sortStage];
    }

    /** Sort by status fields, then by name */
    return getSortByNameStages({
      helper,
      additionalSort: sortStage
    });
  }

  if (sortBy === 'created_at') {
    return [
      /** Sort by creation time */
      { $sort: { created_at: 1 } }
    ];
  }

  if (sortBy === 'owner' || sortBy === 'members') {
    return []; // Will be sorted in memory
  }

  return [
    /** Sort by creation time */
    { $sort: { created_at: 1 } }
  ];
}

/** Get IDs of organizations whose names match the search string */
function getSearchMatchStage(args: {
  helper: OrganizationManagementHelper;
  search: string;
}): PipelineStage.Match {
  const { helper, search } = args;

  if (helper === null) {
    const encryptedSearch = encryptFieldData(search);

    return {
      /** Hash-based matching requires exact search strings */
      $match: {
        $or: [{ 'name.hash': encryptedSearch.hash }]
      }
    };
  }

  const searchRegex = new RegExp(search, 'i');
  const ids = helper
    .filter((doc) => doc.decryptedName.match(searchRegex))
    .map((doc) => doc._id);

  return {
    $match: {
      _id: { $in: ids }
    }
  };
}

const organizationManagement = {
  getOrganizationManagementHelper,
  getSortStages,
  getSearchMatchStage
};

export default organizationManagement;
