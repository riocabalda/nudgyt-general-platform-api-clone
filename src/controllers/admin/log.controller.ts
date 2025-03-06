import asyncWrapper from '../../helpers/async-wrapper';
import logService from '../../services/log.service';
import createResponse from '../../utils/create-response';

const getLogs = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const { search, service, user_status, page } = req.query;
  const user = req.user;

  const logs = await logService.getLogs({
    org,
    user,
    userStatus: Array.isArray(user_status)
      ? (user_status as string[])
      : undefined,
    service: Array.isArray(service) ? (service as string[]) : undefined,
    search: search ? String(search) : undefined,
    page: Number(page) || 1
  });

  const response = createResponse({ customFields: logs });

  res.json(response);
});

export default {
  getLogs
};
