import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

export const UpdateOrganizationSchema = {
  params: z.object({
    org: z.string()
  }),
  body: z.object({
    name: z.string().min(1).optional()
  })
};

export const UpdateInvitationSchema = {
  params: z.object({
    org: z.string(),
    membershipId: z.string()
  }),
  query: z.object({
    action: z.enum(['accept', 'decline'])
  })
};

export const UpdateOwnerInvitationSchema = {
  params: z.object({
    pendingOrgId: z.string()
  }),
  query: z.object({
    action: z.enum(['accept', 'decline']),
    organizationName: z.string()
  })
};

const updateOrganization = validateRequest({
  params: UpdateOrganizationSchema.params,
  body: UpdateOrganizationSchema.body
});

const updateInvitation = validateRequest({
  params: UpdateInvitationSchema.params,
  query: UpdateInvitationSchema.query
});

const updateOwnerInvitation = validateRequest({
  params: UpdateOwnerInvitationSchema.params,
  query: UpdateOwnerInvitationSchema.query
});

export default {
  updateOrganization,
  updateInvitation,
  updateOwnerInvitation
};
