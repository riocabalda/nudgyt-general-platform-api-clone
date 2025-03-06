import { escapeRegExp } from 'lodash';
import { FilterQuery } from 'mongoose';
import {
  InvitationLogType,
  ServiceLogType,
  UserLogType
} from '../constants/logs';
import {
  decryptFieldData,
  encryptFieldData,
  ProtectedField
} from '../helpers/db';
import Log, { LogType } from '../models/log.model';
import Organization from '../models/organization.model';
import { UserType } from '../models/user.model';
import { withFromAndTo } from '../utils/with-from-to';

function encryptPayloadSnapshot(snapshot: Record<string, unknown>) {
  const encryptedEntries = Object.entries(snapshot).map(
    ([key, value]) => [key, encryptFieldData(String(value))]
  );

  return Object.fromEntries(encryptedEntries);
}

function decryptPayloadSnapshot(
  snapshot: Record<string, ProtectedField>
) {
  const entries = Object.entries(snapshot).map(([key, value]) => [
    key,
    decryptFieldData(value)
  ]);

  return Object.fromEntries(entries);
}

async function createLog(log: LogType) {
  await Log.create(log);
}

async function getLogs({
  org,
  user,
  search,
  userStatus,
  service,
  page = 1,
  limit = 20
}: {
  org: string;
  user: UserType;
  search?: string;
  userStatus?: string[];
  service?: string[];
  page: number;
  limit?: number;
}) {
  function* generateUserOrQueries(): Generator<FilterQuery<unknown>> {
    const specifiedUserStatus = userStatus ?? [];

    for (const item of specifiedUserStatus) {
      if (item === 'INVITED') {
        yield {
          type: { $eq: InvitationLogType.INVITE }
        };
      }

      if (item === 'APPROVED') {
        yield {
          type: { $eq: UserLogType.APPROVE }
        };
      }

      if (item === 'BLOCKED') {
        yield {
          type: { $eq: UserLogType.BLOCK }
        };
      }

      if (item === 'UNBLOCKED') {
        yield {
          type: { $eq: UserLogType.UNBLOCK }
        };
      }

      if (item === 'ARCHIVED') {
        yield {
          type: { $eq: UserLogType.ARCHIVE }
        };
      }
    }
  }

  function* generateServiceOrQueries(): Generator<
    FilterQuery<unknown>
  > {
    const specifiedService = service ?? [];

    for (const item of specifiedService) {
      if (item === 'EDITED') {
        yield {
          type: { $eq: ServiceLogType.UPDATE }
        };
      }
      if (item === 'DELETED') {
        yield {
          type: { $eq: ServiceLogType.DELETE }
        };
      }
      if (item === 'PUBLISHED') {
        yield {
          type: { $eq: ServiceLogType.PUBLISH }
        };
      }
    }
  }

  function* generateAndQueries(): Generator<FilterQuery<unknown>> {
    /** Only apply organization filter if not super admin */
    const isUserSuperAdmin = user.is_super_admin ?? false;
    const withOrganizationFilter = !isUserSuperAdmin;
    if (withOrganizationFilter) {
      yield {
        organization: organization?._id
      };
    }

    const serviceOrQueries = [...generateServiceOrQueries()];
    if (serviceOrQueries.length > 0) {
      yield {
        $or: serviceOrQueries
      };
    }

    const userOrQueries = [...generateUserOrQueries()];
    if (userOrQueries.length > 0) {
      yield {
        $or: userOrQueries
      };
    }

    if (search) {
      const escapedSearchString = escapeRegExp(search);
      const searchRegex = new RegExp(escapedSearchString, 'i');

      const encryptedSearch = encryptFieldData(search);

      yield {
        $or: [
          { 'activity.hash': encryptedSearch.hash }, // Hash-based search on activity text (exact match only!)
          { type: { $regex: searchRegex } } // Case insensitive search on log types
        ]
      };
    }
  }

  const encryptedSlug = encryptFieldData(org);

  const organization = await Organization.findOne({
    'slug.hash': encryptedSlug.hash
  });

  const query: FilterQuery<unknown> = {};
  const andQueries = [...generateAndQueries()];
  if (andQueries.length) {
    query.$and = andQueries;
  }

  let paginatedLogs = await Log.paginate(query, {
    sort: { created_at: -1 },
    lean: true,
    leanWithId: false,
    page,
    limit
  });

  paginatedLogs = withFromAndTo(paginatedLogs);

  paginatedLogs.data = (paginatedLogs as any).data.map(
    (log: LogType) => ({
      ...log,
      activity:
        log.activity === null
          ? null
          : log.activity === undefined
          ? undefined
          : decryptFieldData(log.activity)
    })
  );

  return paginatedLogs;
}

export default {
  encryptPayloadSnapshot,
  decryptPayloadSnapshot,

  createLog,
  getLogs
};
