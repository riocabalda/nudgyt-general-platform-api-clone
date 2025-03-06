import { PipelineStage } from 'mongoose';
import Enterprise from '../../models/enterprise.model';
import naturalSort from '../../utils/natural-sort';
import { decryptFieldData, encryptFieldData } from '../db';

type EnterpriseManagementHelper = Awaited<
  ReturnType<typeof getEnterpriseManagementHelper>
>;

/**
 * Decrypt fields to support other functions
 *
 * Will not perform additional query unless conditions are satisfied!
 */
async function getEnterpriseManagementHelper(args: {
  enabled?: boolean;
  search?: string;
  sortBy?: string;
}) {
  const { enabled = false } = args; // Toggle inefficient decryption
  const { search, sortBy } = args;

  if (!enabled) {
    return null;
  }

  const shouldGetDecryptionHelper = search || sortBy === 'name';
  if (!shouldGetDecryptionHelper) {
    return null;
  }

  const enterprises = await Enterprise.find().lean();

  const decrypted = enterprises.map((doc) => ({
    _id: doc._id,
    organizationName: decryptFieldData(doc.organization_name),
    email: decryptFieldData(doc.email),
    platformUrl: decryptFieldData(doc.platform_url)
  }));

  return decrypted;
}

/**
 * Sort names in API side,
 * and use their associated IDs to sort in DB side
 */
function getSortByNameStages(args: {
  helper: NonNullable<EnterpriseManagementHelper>;
  additionalSort?: PipelineStage.Sort;
}) {
  const { helper, additionalSort } = args;

  const idsOfSortedNames = helper
    .sort((a, b) => naturalSort(a.organizationName, b.organizationName))
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
  helper: EnterpriseManagementHelper;
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
        { $sort: { 'organization_name.hash': 1 } }
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

  if (sortBy === 'rate') {
    return [{ $sort: { monthly_amount: 1 } }];
  }

  if (sortBy === 'seats') {
    return [{ $sort: { user_seats: 1 } }];
  }

  return [
    /** Sort by creation time */
    { $sort: { created_at: 1 } }
  ];
}

/** Get IDs of organizations whose names match the search string */
function getSearchMatchStage(args: {
  helper: EnterpriseManagementHelper;
  search: string;
}): PipelineStage.Match {
  const { helper, search } = args;

  if (helper === null) {
    const encryptedSearch = encryptFieldData(search);

    return {
      /** Hash-based matching requires exact search strings */
      $match: {
        $or: [{ 'organization_name.hash': encryptedSearch.hash }]
      }
    };
  }

  const searchRegex = new RegExp(search, 'i');
  const ids = helper
    .filter(
      (doc) =>
        doc.organizationName.match(searchRegex) ||
        doc.email.match(searchRegex) ||
        doc.platformUrl.match(searchRegex)
    )
    .map((doc) => doc._id);

  return {
    $match: {
      _id: { $in: ids }
    }
  };
}

const enterpriseManagement = {
  getEnterpriseManagementHelper,
  getSortStages,
  getSearchMatchStage
};

export default enterpriseManagement;
