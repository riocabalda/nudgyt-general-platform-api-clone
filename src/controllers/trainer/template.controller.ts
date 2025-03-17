import asyncWrapper from '../../helpers/async-wrapper';
import templateService from '../../services/trainer/template.service';
import createResponse from '../../utils/create-response';

const getTemplates = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const {
    search,
    sort_by,
    page,
    is_published,
    user_templates,
    master_templates
  } = req.query;
  const user = req.user;

  const userTemplates: boolean | undefined = {
    true: true,
    false: false
  }[user_templates as string];

  const masterTemplates: boolean | undefined = {
    true: true,
    false: false
  }[master_templates as string];

  const isPublished: boolean | undefined = {
    true: true,
    false: false
  }[is_published as string];

  const templates = await templateService.getTemplates({
    orgSlug: org,
    user,
    search: search as string,
    sortBy: sort_by as string,
    page: Number(page) || 1,
    userTemplates,
    masterTemplates,
    isPublished
  });

  const response = createResponse({ customFields: templates });

  res.json(response);
});

const getTemplateById = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  const template = await templateService.getTemplateById({
    templateId: id
  });

  const response = createResponse({ data: template });

  res.json(response);
});

const createTemplate = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const templateData = req.body;
  const user = req.user;
  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  const template = await templateService.createTemplate({
    org,
    user,
    templateData,
    files,
    reqAuth: req.auth
  });

  const response = createResponse({ data: template });

  res.json(response);
});

const editTemplate = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const templateData = req.body;

  const files = req.files as {
    [fieldname: string]: Express.Multer.File[];
  };

  const template = await templateService.editTemplate({
    templateId: id,
    templateData,
    files,
    user: req.user,
    reqAuth: req.auth
  });

  const response = createResponse({ data: template });

  res.json(response);
});

const deleteTemplate = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  await templateService.deleteTemplate({
    templateId: id,
    user: req.user,
    reqAuth: req.auth
  });

  const response = createResponse({
    message: 'Template deleted successfully'
  });

  res.json(response);
});

const shareTemplateToOrganizations = asyncWrapper(
  async (req, res, next) => {
    const { id } = req.params;
    const { organization_ids, is_published } = req.body;

    const result = await templateService.shareTemplateToOrganizations({
      templateId: id,
      organizationIds: organization_ids,
      isPublished: is_published,
      user: req.user,
      reqAuth: req.auth
    });

    const response = createResponse({ data: result });

    res.json(response);
  }
);

const getSharedTemplates = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const user = req.user;

  const templates = await templateService.getSharedTemplates({
    user,
    org
  });

  const response = createResponse({ data: templates });

  res.json(response);
});

const duplicateTemplate = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const { org } = req.params;
  const user = req.user;

  const template = await templateService.duplicateTemplate({
    templateId: id,
    user,
    orgSlug: org,
    reqAuth: req.auth
  });

  const response = createResponse({ data: template });

  res.json(response);
});

const getMostPopularTemplates = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const user = req.user;
  const { page, limit } = req.query;

  const templates = await templateService.getMostPopularTemplates({
    org,
    user,
    page: Number(page) || 1,
    limit: Number(limit) || 9
  });

  const response = createResponse({ data: templates });

  res.json(response);
});

const publishTemplate = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const { org } = req.params;
  const user = req.user;

  const template = await templateService.publishTemplate({
    templateId: id,
    orgSlug: org,
    user,
    reqAuth: req.auth
  });

  const response = createResponse({ data: template });

  res.json(response);
});

const unpublishTemplate = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  const template = await templateService.unpublishTemplate({
    templateId: id,
    user: req.user,
    reqAuth: req.auth
  });

  const response = createResponse({ data: template });

  res.json(response);
});

export default {
  getTemplates,
  getTemplateById,
  createTemplate,
  editTemplate,
  shareTemplateToOrganizations,
  getSharedTemplates,
  deleteTemplate,
  duplicateTemplate,
  getMostPopularTemplates,
  publishTemplate,
  unpublishTemplate
};
