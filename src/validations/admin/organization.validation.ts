import z from 'zod';
import { validateRequest } from 'zod-express-middleware';
import { OrganizationStatus } from '../../models/organization.model';

export const GetEnterprisesSchema = z.object({
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
  search: z.string().optional(),
  status: z.string().array().optional(),
  sortBy: z.string().optional()
});

export const UpdateOrganizationParamsSchema = z.object({
  id: z.string()
});

export const UpdateOrganizationBodySchema = z.object({
  status: z.enum([
    OrganizationStatus.Active,
    OrganizationStatus.Inactive,
    OrganizationStatus.Suspended
  ])
});

export const UpdateEnterpriseSchema = {
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    status: z.enum([
      OrganizationStatus.Active,
      OrganizationStatus.Inactive,
      OrganizationStatus.Suspended
    ])
  })
};

export const BulkUpdateOrganizationSchema = z.object({
  organizationIds: z
    .array(z.string())
    .min(1, 'At least one organization must be selected'),
  status: z.enum([
    OrganizationStatus.Active,
    OrganizationStatus.Inactive,
    OrganizationStatus.Suspended
  ])
});

export const BulkUpdateEnterprisesSchema = z.object({
  enterpriseIds: z
    .string()
    .array()
    .min(1, 'At least one enterprise must be selected'),
  status: z.enum([
    OrganizationStatus.Active,
    OrganizationStatus.Inactive,
    OrganizationStatus.Suspended
  ])
});

export const AddOrgExtraLearnersBodySchema = z.object({
  extraLearners: z
    .number()
    .min(0, 'Extra learners must be a positive number')
});

const getEnterprises = validateRequest({
  query: GetEnterprisesSchema
});

const updateOrganization = validateRequest({
  params: UpdateOrganizationParamsSchema,
  body: UpdateOrganizationBodySchema
});

const updateEnterprise = validateRequest({
  params: UpdateEnterpriseSchema.params,
  body: UpdateEnterpriseSchema.body
});

const bulkUpdateOrganizations = validateRequest({
  body: BulkUpdateOrganizationSchema
});

const bulkUpdateEnterprises = validateRequest({
  body: BulkUpdateEnterprisesSchema
});

const addOrgExtraLearners = validateRequest({
  body: AddOrgExtraLearnersBodySchema
});

export default {
  getEnterprises,
  updateOrganization,
  updateEnterprise,
  bulkUpdateOrganizations,
  bulkUpdateEnterprises,
  addOrgExtraLearners
};
