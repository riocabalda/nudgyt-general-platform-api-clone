import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';
import { TypedRequest } from 'zod-express-middleware';
import asyncWrapper from '../helpers/async-wrapper';
import organizationService from '../services/organization.service';
import createResponse from '../utils/create-response';
import {
  UpdateInvitationSchema,
  UpdateOrganizationSchema,
  UpdateOwnerInvitationSchema
} from '../validations/organization.validation';

const getOrganization = asyncWrapper(async (req, res, next) => {
  const org = await organizationService.getOrganization({
    user: req.user,
    orgSlug: req.params.org
  });

  const response = createResponse({
    data: org
  });
  res.json(response);
});

const updateOrganization = asyncWrapper(
  (
    req: TypedRequest<
      typeof UpdateOrganizationSchema.params,
      never,
      typeof UpdateOrganizationSchema.body
    >,
    res,
    next
  ) =>
    mongoose.connection.transaction(async (session) => {
      const filesObj = Array.isArray(req.files) ? undefined : req.files;
      const logoFile = filesObj?.logo?.[0];

      let logo: string | undefined;
      if (logoFile !== undefined) {
        logo = await organizationService.uploadOrganizationLogo(
          logoFile
        );
      }

      const updatedOrg = await organizationService.updateOrganization({
        session,
        user: req.user,
        orgSlug: req.params.org,
        update: {
          name: req.body.name,
          logo
        }
      });

      const response = createResponse({
        message: 'Organization updated',
        data: updatedOrg
      });
      res.status(StatusCodes.OK).json(response);
    })
);

const updateInvitation = asyncWrapper(
  async (
    req: TypedRequest<
      typeof UpdateInvitationSchema.params,
      typeof UpdateInvitationSchema.query,
      never
    >,
    res,
    next
  ) => {
    const { org: orgSlug, membershipId } = req.params;
    const { action } = req.query;
    const user = req.user;

    await mongoose.connection.transaction(async (session) => {
      await organizationService.updateInvitation({
        session,
        user,
        action,
        orgSlug,
        membershipId
      });

      const response = createResponse({
        message: 'Invitation updated'
      });
      res.json(response);
    });
  }
);

const updateOwnerInvitation = asyncWrapper(
  async (
    req: TypedRequest<
      typeof UpdateOwnerInvitationSchema.params,
      typeof UpdateOwnerInvitationSchema.query,
      never
    >,
    res,
    next
  ) => {
    const { pendingOrgId } = req.params;
    const { action, organizationName } = req.query;
    const user = req.user;

    await mongoose.connection.transaction(async (session) => {
      const newOrg = await organizationService.updateOwnerInvitation({
        session,
        user,
        action,
        pendingOrgId,
        organizationName
      });

      const response = createResponse({
        message: 'Owner invitation updated',
        data: newOrg
      });
      res.json(response);
    });
  }
);

export default {
  getOrganization,
  updateOrganization,
  updateInvitation,
  updateOwnerInvitation
};
