import mongoose from 'mongoose';
import {
  TypedRequest,
  TypedRequestBody,
  TypedRequestQuery
} from 'zod-express-middleware';
import asyncWrapper from '../../helpers/async-wrapper';
import {
  default as adminOrganizationService,
  default as superAdminOrganizationService
} from '../../services/admin/organization.service';
import organizationService from '../../services/organization.service';
import createResponse from '../../utils/create-response';
import {
  BulkUpdateEnterprisesSchema,
  BulkUpdateOrganizationSchema,
  GetEnterprisesSchema,
  UpdateEnterpriseSchema,
  UpdateOrganizationBodySchema,
  UpdateOrganizationParamsSchema
} from '../../validations/admin/organization.validation';

const getOrganizationsForSuperAdmin = asyncWrapper(
  async (req, res, next) => {
    const organizations =
      await superAdminOrganizationService.getOrganizations();

    const response = createResponse({
      data: organizations
    });
    res.json(response);
  }
);

const getOrganizations = asyncWrapper(async (req, res) => {
  const { page, limit, search, status, sortBy, tier } = req.query;

  const paginatedOrganizations =
    await organizationService.getOrganizations({
      tier: tier as string,
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      search: search as string,
      status: status as string[],
      sortBy: sortBy as string
    });

  const response = createResponse({
    customFields: paginatedOrganizations
  });

  res.json(response);
});

const getEnterprises = asyncWrapper(
  async (req: TypedRequestQuery<typeof GetEnterprisesSchema>, res) => {
    const { page = 1, limit = 20, search, status, sortBy } = req.query;

    const paginatedEnterprises =
      await organizationService.getEnterprises({
        page,
        limit,
        search,
        status,
        sortBy
      });

    const response = createResponse({
      customFields: paginatedEnterprises
    });
    res.json(response);
  }
);

const updateOrganizationStatus = asyncWrapper(
  async (
    req: TypedRequest<
      typeof UpdateOrganizationParamsSchema,
      any,
      typeof UpdateOrganizationBodySchema
    >,
    res
  ) => {
    const { id } = req.params;
    const { status } = req.body;

    const updatedOrg =
      await organizationService.updateOrganizationStatus({
        orgId: id,
        status,
        user: req.user,
        reqAuth: req.auth
      });

    const response = createResponse({
      data: updatedOrg
    });
    res.json(response);
  }
);

const updateEnterprise = asyncWrapper(
  async (
    req: TypedRequest<
      typeof UpdateEnterpriseSchema.params,
      never,
      typeof UpdateEnterpriseSchema.body
    >,
    res
  ) =>
    mongoose.connection.transaction(async (session) => {
      const { id } = req.params;
      const { status } = req.body;

      const updatedEnterprise =
        await organizationService.updateEnterprise({
          session,
          id,
          status,
          user: req.user,
          reqAuth: req.auth
        });

      const response = createResponse({
        data: updatedEnterprise
      });
      res.json(response);
    })
);

const bulkUpdateOrganizationStatus = asyncWrapper(
  async (
    req: TypedRequestBody<typeof BulkUpdateOrganizationSchema>,
    res
  ) => {
    const { organizationIds, status } = req.body;

    const result =
      await organizationService.bulkUpdateOrganizationStatus({
        organizationIds,
        status,
        user: req.user,
        reqAuth: req.auth
      });

    const response = createResponse({
      data: result,
      message: `Successfully updated ${organizationIds.length} organizations`
    });

    res.json(response);
  }
);

const bulkUpdateEnterprises = asyncWrapper(
  (
    req: TypedRequestBody<typeof BulkUpdateEnterprisesSchema>,
    res,
    next
  ) =>
    mongoose.connection.transaction(async (session) => {
      const { enterpriseIds, status } = req.body;

      const result = await organizationService.bulkUpdateEnterprises({
        session,
        enterpriseIds,
        status,
        user: req.user,
        reqAuth: req.auth
      });

      const response = createResponse({
        data: result,
        message: `Successfully updated ${enterpriseIds.length} enterprises`
      });
      res.json(response);
    })
);

const getPublicOrganization = asyncWrapper(async (req, res) => {
  const publicOrganization =
    await organizationService.getPublicOrganization();

  const response = createResponse({
    data: publicOrganization
  });

  res.json(response);
});

const addOrgExtraLearners = asyncWrapper(async (req, res) => {
  const { orgSlug } = req.params;
  const { extraLearners } = req.body;

  const result = await adminOrganizationService.addOrgExtraLearners({
    orgSlug,
    extraLearners,
    user: req.user,
    reqAuth: req.auth
  });

  const response = createResponse({
    data: result,
    message: 'Successfully added extra learners.'
  });

  res.json(response);
});

const getOrgLearnersCount = asyncWrapper(async (req, res) => {
  const { orgSlug } = req.params;
  const result =
    await adminOrganizationService.getOrganizationMembersCount(
      orgSlug,
      ['Learner']
    );

  const response = createResponse({
    data: result
  });

  res.json(response);
});

const getOrganizationBySlug = asyncWrapper(async (req, res) => {
  const { orgSlug } = req.params;
  const result = await organizationService.getOrganizationBySlug(
    orgSlug,
    {
      includeSubscription: true
    }
  );

  const response = createResponse({
    data: result
  });

  res.json(response);
});

export default {
  getOrganizations,
  updateOrganizationStatus,
  updateEnterprise,
  getEnterprises,
  bulkUpdateOrganizationStatus,
  bulkUpdateEnterprises,
  getPublicOrganization,
  getOrganizationsForSuperAdmin,
  addOrgExtraLearners,
  getOrgLearnersCount,
  getOrganizationBySlug
};
