import { escapeRegExp } from 'lodash';
import messages from '../../constants/response-messages';
import { uploadFile } from '../../helpers/uploads';
import Environment, {
  EnvironmentType
} from '../../models/environment.model';
import {
  getSortQuery,
  SortOption,
  SortQuery
} from '../../utils/service-sort-keys';
import { withFromAndTo } from '../../utils/with-from-to';

async function uploadEnvironmentImage(file: Express.Multer.File) {
  const url = await uploadFile({
    file,
    keyPrefix: 'environments'
  });

  return url;
}

async function createEnvironment(
  environmentData: Partial<EnvironmentType>
) {
  const newEnvironment = await Environment.create(environmentData);

  return newEnvironment;
}

async function updateEnvironment({
  id,
  environmentData
}: {
  id: string;
  environmentData: Partial<EnvironmentType>;
}) {
  const environment = await Environment.findById(id);
  if (!environment) throw Error(messages.ENVIRONMENT_NOT_FOUND);

  const updatedEnvironment = await Environment.findByIdAndUpdate(
    { _id: id },
    environmentData,
    { new: true }
  );

  return updatedEnvironment;
}

async function deleteEnvironment({ id }: { id: string }) {
  const environment = await Environment.findById(id);
  if (!environment) throw Error(messages.ENVIRONMENT_NOT_FOUND);

  await Environment.findByIdAndUpdate(id, { deleted_at: new Date() });
  return { message: messages.ENVIRONMENT_DELETED };
}

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

  andQueries.push({
    deleted_at: null
  });

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
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  uploadEnvironmentImage,
  getEnvironmentById
};
