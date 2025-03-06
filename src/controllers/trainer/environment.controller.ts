import asyncWrapper from '../../helpers/async-wrapper';
import environmentService from '../../services/trainer/environment.service';
import createResponse from '../../utils/create-response';
import { SortOption } from '../../utils/service-sort-keys';

const getEnvironments = asyncWrapper(async (req, res, next) => {
  const { search, sortBy } = req.query;

  const environments = await environmentService.getEnvironments({
    search: search as string,
    sortBy: sortBy as SortOption
  });

  const response = createResponse({ customFields: environments });

  res.json(response);
});

const getEnvironmentById = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  const environment = await environmentService.getEnvironmentById(id);

  const response = createResponse({ data: environment });

  res.json(response);
});

export default {
  getEnvironments,
  getEnvironmentById
};
