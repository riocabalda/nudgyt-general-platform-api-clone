import asyncWrapper from '../../helpers/async-wrapper';
import serviceService from '../../services/learner/service.service';
import createResponse from '../../utils/create-response';

const getMostPopularServices = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;

  const mostPopularService =
    await serviceService.getMostPopularServices({
      orgSlug: org
    });

  const response = createResponse({
    data: mostPopularService
  });
  res.json(response);
});

const getServices = asyncWrapper(async (req, res, next) => {
  const { search, sort_by, service_view, page, limit } = req.query;
  const user = req.user;
  const { org } = req.params;

  const services = await serviceService.getServices({
    orgSlug: org,
    user,
    search: search ? String(search) : undefined,
    service_view: service_view ? String(service_view) : undefined,
    sortBy: sort_by ? String(sort_by) : undefined,
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

export default {
  getMostPopularServices,
  getServices,
  getServiceById
};
