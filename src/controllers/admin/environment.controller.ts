import messages from '../../constants/response-messages';
import asyncWrapper from '../../helpers/async-wrapper';
import environmentService from '../../services/admin/environment.service';
import createResponse from '../../utils/create-response';
import { SortOption } from '../../utils/service-sort-keys';

const createEnvironment = asyncWrapper(async (req, res, next) => {
  const environmentData = req.body;
  const filesObj = Array.isArray(req.files) ? undefined : req.files;
  const imageFile = filesObj?.image?.[0];

  let file: string | undefined;
  if (imageFile !== undefined) {
    file = await environmentService.uploadEnvironmentImage(imageFile);
  }

  const environment = await environmentService.createEnvironment({
    ...environmentData,
    image: file
  });

  const response = createResponse({ data: environment });

  res.json(response);
});

const updateEnvironment = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const environmentData = req.body;
  const filesObj = Array.isArray(req.files) ? undefined : req.files;
  const imageFile = filesObj?.image?.[0];

  let file: string | undefined;
  if (imageFile !== undefined) {
    file = await environmentService.uploadEnvironmentImage(imageFile);
  }

  const environment = await environmentService.updateEnvironment({
    id,
    environmentData: {
      ...environmentData,
      image: file
    }
  });

  const response = createResponse({ data: environment });

  res.json(response);
});

const deleteEnvironment = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  await environmentService.deleteEnvironment({ id });

  res.json({ message: messages.ENVIRONMENT_DELETED });
});

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
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
  getEnvironmentById
};
