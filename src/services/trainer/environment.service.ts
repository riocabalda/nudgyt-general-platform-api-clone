import { escapeRegExp } from 'lodash';
import {
  getSortQuery,
  SortOption,
  SortQuery
} from '../../utils/service-sort-keys';
import Environment from '../../models/environment.model';
import { withFromAndTo } from '../../utils/with-from-to';
import messages from '../../constants/response-messages';

async function getEnvironments({
  search,
  sortBy
}: {
  search?: string;
  sortBy?: SortOption;
}) {
  let query = {};
  const andQueries = [];
  let sort: SortQuery = { created_at: -1 };

  if (search) {
    const escapedSearchString = escapeRegExp(search);
    const searchRegex = new RegExp(escapedSearchString, 'i');
    andQueries.push({
      location: { $regex: searchRegex }
    });
  }

  if (sortBy) {
    sort = getSortQuery(sortBy, 'location');
  }

  if (andQueries.length) {
    query = { $and: andQueries };
  }

  let environments = await Environment.paginate(query, { sort });
  environments = withFromAndTo(environments);
  return environments;
}

async function getEnvironmentById(id: string) {
  const environment = await Environment.findById(id);
  if (!environment) throw Error(messages.ENVIRONMENT_NOT_FOUND);
  return environment;
}

export default {
  getEnvironments,
  getEnvironmentById
};
