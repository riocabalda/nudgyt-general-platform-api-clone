import messages from '../../constants/response-messages';
import asyncWrapper from '../../helpers/async-wrapper';
import serviceService from '../../services/admin/service.service';
import createResponse from '../../utils/create-response';

const getServiceTypes = asyncWrapper(async (req, res, next) => {
  const serviceTypes = await serviceService.getServiceTypes();

  const response = createResponse({ data: serviceTypes });

  res.json(response);
});

const createServiceLevel = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const serviceLevelData = req.body;
  const user = req.user;
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  const serviceLevel = await serviceService.createService({
    org,
    user,
    serviceLevelData,
    files,
    reqAuth: req.auth
  });

  const response = createResponse({ data: serviceLevel });
  res.json(response);
});

const updateServiceLevel = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const serviceLevelData = req.body;
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  const service = await serviceService.updateService({
    id,
    serviceLevelData,
    files,
    user: req.user,
    reqAuth: req.auth
  });

  const response = createResponse({ data: service });
  res.json(response);
});

const getServiceMetrics = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const { timeFrame } = req.query as {
    timeFrame:
      | 'seven-days'
      | 'today'
      | 'yesterday'
      | 'weekly'
      | 'monthly'
      | 'yearly';
  };

  const metrics = await serviceService.getServiceMetrics({
    orgSlug: org,
    timeFrame
  });

  const response = createResponse({
    data: metrics
  });
  res.json(response);
});

const getPopularServices = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;

  const metrics = await serviceService.getPopularServices({
    orgSlug: org
  });

  const response = createResponse({
    data: metrics
  });
  res.json(response);
});

const getServicesStats = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const { search, page, limit } = req.query as {
    search: string;
    page: string;
    limit: string;
  };

  const paginatedServices = await serviceService.getServicesStats({
    orgSlug: org,
    search,
    page: Number(page) || 1,
    limit: Number(limit) || 10
  });

  const response = createResponse({
    data: paginatedServices
  });
  res.json(response);
});

const getServices = asyncWrapper(async (req, res, next) => {
  const { search, is_published, sort_by, page, limit, user_services } =
    req.query;
  const user = req.user;
  const { org } = req.params;

  const userServices: boolean | undefined = {
    true: true,
    false: false
  }[user_services as string];

  const isPublished: boolean | undefined = {
    true: true,
    false: false
  }[is_published as string];

  const services = await serviceService.getServices({
    orgSlug: org,
    user,
    search: search ? String(search) : undefined,
    sortBy: sort_by ? String(sort_by) : undefined,
    isPublished,
    userServices,
    page: Number(page) || 1,
    limit: Number(limit) || 9
  });
  const response = createResponse({ customFields: services });
  res.json(response);
});

const getServiceById = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  const service = await serviceService.getServiceById(id);
  const response = createResponse({ data: service });
  res.json(response);
});

const publishService = asyncWrapper(async (req, res, next) => {
  const { id, org } = req.params;
  const user = req.user;

  await serviceService.updatePublishFieldService({
    id,
    user,
    org,
    isPublished: true,
    reqAuth: req.auth
  });

  const response = createResponse({
    message: messages.SERVICE_PUBLISHED
  });
  res.json(response);
});

const unpublishService = asyncWrapper(async (req, res, next) => {
  const { id, org } = req.params;
  const user = req.user;

  await serviceService.updateUnpublishFieldService({
    id,
    user,
    org,
    isPublished: false,
    reqAuth: req.auth
  });
  const response = createResponse({
    message: messages.SERVICE_DRAFTED
  });
  res.json(response);
});

const deleteService = asyncWrapper(async (req, res, next) => {
  const { id, org } = req.params;
  await serviceService.deleteService(id, req.user, org, req.auth);

  const response = createResponse({
    message: messages.SERVICE_DELETED
  });
  res.json(response);
});

const getRecentServices = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const { search, page, limit, isRecent } = req.query as {
    search: string;
    page: string;
    limit: string;
    isRecent: string;
  };

  const paginatedServices = await serviceService.getRecentServices({
    orgSlug: org,
    search,
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    isRecent: isRecent === 'true'
  });

  const response = createResponse({
    data: paginatedServices
  });
  res.json(response);
});

const getServiceLearnersScores = asyncWrapper(
  async (req, res, next) => {
    const { id } = req.params;
    const learnersScores =
      await serviceService.getServiceLearnersScores(id);

    const response = createResponse({
      data: learnersScores
    });
    res.json(response);
  }
);

export default {
  getServices,
  getServiceTypes,
  createServiceLevel,
  updateServiceLevel,
  getServiceMetrics,
  getPopularServices,
  getServicesStats,
  getRecentServices,
  getServiceById,
  publishService,
  unpublishService,
  deleteService,
  getServiceLearnersScores
};
