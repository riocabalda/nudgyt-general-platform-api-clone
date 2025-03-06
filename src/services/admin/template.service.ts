import { escapeRegExp, flattenDeep, groupBy } from 'lodash';
import { Types } from 'mongoose';
import { TemplateLogType } from '../../constants/logs';
import messages from '../../constants/response-messages';
import { decryptFieldData, encryptFieldData } from '../../helpers/db';
import { uploadFile } from '../../helpers/uploads';
import { RequestAuth } from '../../middlewares/require-permissions';
import Character from '../../models/character.model';
import Environment from '../../models/environment.model';
import Rubric from '../../models/rubric.model';
import ServiceType from '../../models/service-type.model';
import Template, { TemplateType } from '../../models/template.model';
import { UserType } from '../../models/user.model';
import csvParser from '../../utils/csv-parser';
import formatQuestions from '../../utils/format-questions';
import { getOrgIdByOrgSlug } from '../../utils/get-org-id-by-org-slug';
import {
  getSortQuery,
  SortOption,
  SortQuery
} from '../../utils/service-sort-keys';
import { withFromAndTo } from '../../utils/with-from-to';
import logService from '../log.service';
async function getTemplates({
  org,
  user,
  search,
  sortBy,
  page = 1,
  limit = 20
}: {
  org: string;
  user: UserType;
  search?: string;
  sortBy?: string;
  page?: number;
  limit?: number;
}) {
  let query = {};
  const andQueries = [];
  let sort: SortQuery = { created_at: -1 };

  const userOrgId = getOrgIdByOrgSlug({ user, org });

  andQueries.push({ deleted_at: { $eq: null } });

  andQueries.push({
    $or: [
      { $and: [{ creator: user.id }, { organization: userOrgId }] },
      {
        $and: [
          { organization: userOrgId },
          { is_published: true },
          { creator: { $ne: user.id } }
        ]
      },
      {
        $and: [
          { shared_to_organizations: userOrgId },
          { is_published: true }
        ]
      }
    ]
  });

  if (search) {
    const escapedSearchString = escapeRegExp(search);
    const searchRegex = new RegExp(escapedSearchString, 'i');
    andQueries.push({
      $or: [
        { title: { $regex: searchRegex } },
        { description: { $regex: searchRegex } }
      ]
    });
  }

  if (sortBy) {
    sort = getSortQuery(sortBy as SortOption);
  }

  if (andQueries.length) {
    query = { $and: andQueries };
  }

  let templates = await Template.paginate(query, {
    sort,
    limit,
    page,
    populate: [
      {
        path: 'organization',
        transform: (doc: any) => {
          if (!doc) return null;
          return {
            ...doc.toObject(),
            name: decryptFieldData(doc.name),
            slug: decryptFieldData(doc.slug)
          };
        }
      },
      { path: 'characters' },
      {
        path: 'characters',
        populate: { path: 'avatar' }
      },
      {
        path: 'creator',
        transform: (doc: any) => {
          if (!doc) return null;
          return {
            _id: doc._id,
            full_name: decryptFieldData(doc.full_name)
          };
        }
      },
      { path: 'environment' },
      { path: 'service_type' },
      { path: 'rubrics' }
    ]
  });

  templates = withFromAndTo(templates);
  return templates;
}

async function getTemplateById({ templateId }: { templateId: string }) {
  const template = await Template.findById(templateId).populate([
    'characters',
    {
      path: 'characters',
      populate: {
        path: 'avatar'
      }
    },
    'service_type',
    'environment',
    'rubrics'
  ]);
  return template;
}

async function createTemplates({
  org,
  user,
  templateData,
  files,
  reqAuth
}: {
  org: string;
  user: UserType;
  templateData: Partial<TemplateType>;
  files: { [fieldname: string]: Express.Multer.File[] };
  reqAuth: RequestAuth;
}) {
  const { environment, service_type, characters } = templateData;

  const STRING_NULL = 'null';
  let existingServiceType = undefined;
  const hasErrors: boolean[] = [];

  if (service_type && service_type.toString() !== STRING_NULL) {
    existingServiceType = await ServiceType.findById(service_type);
    if (!existingServiceType) hasErrors.push(true);
  }

  if (environment && environment.toString() !== STRING_NULL) {
    const existingEnvironment = await Environment.findById(environment);
    if (!existingEnvironment) hasErrors.push(true);
  } else {
    templateData.environment = undefined;
  }

  if (
    characters &&
    characters.toString() !== STRING_NULL &&
    characters.toString() !== ''
  ) {
    const characterIds = Array.isArray(characters)
      ? characters
      : (characters as string)
          .split(',')
          .filter((id) => id.trim())
          .map((id: string) => new Types.ObjectId(id.trim()));

    if (characterIds.length > 0) {
      const existingCharacters = await Character.find({
        _id: { $in: characterIds }
      });
      if (existingCharacters.length !== characterIds.length) {
        hasErrors.push(true);
      }
      templateData.characters = characterIds;
    } else {
      templateData.characters = [];
    }
  } else {
    templateData.characters = [];
  }

  if (hasErrors.some((isError) => isError)) {
    throw Error(messages.CHARACTER_ENVIRONMENT_SERVICE_TYPE_NOT_FOUND);
  }

  const fileTimestamp = Date.now();
  const fileUuid = crypto.randomUUID();

  let newFormatQuestions: any[] = [];
  let formQuestionsFileUrl: string | null = null;

  if (files.form_questions) {
    const formQuestionsFile = files.form_questions[0];

    const formQuestions = await csvParser(formQuestionsFile.buffer);

    const questionsBySection = groupBy(formQuestions, 'section');
    newFormatQuestions = formatQuestions(questionsBySection);

    formQuestionsFileUrl = await uploadFile({
      file: formQuestionsFile,
      keyPrefix: `templates/${fileTimestamp}_${fileUuid}`,
      filenameType: 'keep'
    });
  }

  let newRubrics: any[] = [];

  if (files.rubrics) {
    const rubricsFile = files.rubrics[0];
    const rubrics = await csvParser(rubricsFile.buffer);
    newRubrics = rubrics;

    const rubricsFileUrl = await uploadFile({
      file: rubricsFile,
      keyPrefix: `templates/${fileTimestamp}_${fileUuid}`,
      filenameType: 'keep'
    });

    const rubric = await Rubric.create({
      rubric_items: newRubrics,
      file: rubricsFileUrl
    });

    templateData.rubrics = rubric.id;
  }

  templateData.is_master_template = user.is_super_admin ?? false;
  templateData.creator = user.id;
  templateData.is_published = false;
  templateData.organization = getOrgIdByOrgSlug({
    user,
    org
  }) as Types.ObjectId;
  templateData.form_questions = flattenDeep(newFormatQuestions);
  templateData.form_questions_file = formQuestionsFileUrl;

  const newTemplate = await Template.create(templateData);

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const templateTitle = newTemplate.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      org,
      templateData: JSON.stringify(templateData)
    }),
    type: TemplateLogType.CREATE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) created template ${templateTitle}`
    )
  });

  return newTemplate;
}

async function editTemplate({
  templateId,
  templateData,
  files,
  user,
  reqAuth
}: {
  templateId: string;
  templateData: Partial<TemplateType>;
  files: { [fieldname: string]: Express.Multer.File[] };
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const template = await Template.findById(templateId);

  if (!template) {
    throw new Error(messages.TEMPLATE_NOT_FOUND);
  }

  const { environment, service_type, characters } = templateData;

  const STRING_NULL = 'null';
  let existingEnvironment = undefined;
  let existingServiceType = undefined;
  let existingCharacters = undefined;
  const hasErrors: boolean[] = [];

  if (service_type && service_type.toString() !== STRING_NULL) {
    existingServiceType = await ServiceType.findById(service_type);
    if (!existingServiceType) hasErrors.push(true);
  }

  if (environment && environment.toString() !== STRING_NULL) {
    existingEnvironment = await Environment.findById(environment);
    if (!existingEnvironment) hasErrors.push(true);
  }

  if (characters) {
    const characterIds = Array.isArray(characters)
      ? characters
      : (characters as string)
          .split(',')
          .map((id: string) => new Types.ObjectId(id.trim()));

    existingCharacters = await Character.find({
      _id: { $in: characterIds }
    });
    if (existingCharacters.length !== characterIds.length) {
      hasErrors.push(true);
    }
    templateData.characters = characterIds;
  }

  if (hasErrors.some((isError) => isError)) {
    throw Error(messages.CHARACTER_ENVIRONMENT_SERVICE_TYPE_NOT_FOUND);
  }

  const fileTimestamp = Date.now();
  const fileUuid = crypto.randomUUID();

  let newFormatQuestions: any[] = [];
  let formQuestionsFileUrl: string | null = null;

  if (files.form_questions) {
    const formQuestionsFile = files.form_questions[0];

    const formQuestions = await csvParser(formQuestionsFile.buffer);

    const questionsBySection = groupBy(formQuestions, 'section');
    newFormatQuestions = formatQuestions(questionsBySection);

    formQuestionsFileUrl = await uploadFile({
      file: formQuestionsFile,
      keyPrefix: `templates/${fileTimestamp}_${fileUuid}`,
      filenameType: 'keep'
    });
  }

  let newRubrics: any[] = [];

  if (files.rubrics) {
    const rubricsFile = files.rubrics[0];
    const rubrics = await csvParser(rubricsFile.buffer);
    newRubrics = rubrics;

    const rubricsFileUrl = await uploadFile({
      file: rubricsFile,
      keyPrefix: `templates/${fileTimestamp}_${fileUuid}`,
      filenameType: 'keep'
    });

    const existingRubricDoc = await Rubric.findById(template.rubrics);
    if (existingRubricDoc !== null) {
      existingRubricDoc.rubric_items = newRubrics;
      existingRubricDoc.file = rubricsFileUrl;

      await existingRubricDoc.save();
    } else {
      const newRubricDoc = await Rubric.create({
        rubric_items: newRubrics,
        file: rubricsFileUrl
      });

      templateData.rubrics = newRubricDoc.id;
    }
  }

  templateData.characters = templateData.characters || [];
  templateData.environment = templateData.environment || undefined;
  template.set(templateData);
  template.form_questions = flattenDeep(newFormatQuestions);
  template.form_questions_file = formQuestionsFileUrl;

  await template.save();

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const templateTitle = template.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      templateId,
      templateData: JSON.stringify(templateData)
    }),
    type: TemplateLogType.UPDATE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) updated ${templateTitle}`
    )
  });

  return template;
}

async function deleteTemplate(args: {
  templateId: string;
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const { templateId } = args;
  const { user, reqAuth } = args;

  const template = await Template.findById(templateId);

  if (!template) {
    throw new Error(messages.TEMPLATE_NOT_FOUND);
  }

  template.deleted_at = new Date();
  await template.save();

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const templateTitle = template.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      templateId
    }),
    type: TemplateLogType.DELETE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) deleted ${templateTitle}`
    )
  });

  return template;
}

async function shareTemplateToOrganizations({
  organizationIds,
  templateId,
  isPublished,
  user,
  reqAuth
}: {
  organizationIds: string[];
  templateId: string;
  isPublished: boolean;
  user: UserType;
  reqAuth: RequestAuth;
}) {
  const template = await Template.findById(templateId);

  if (!template) {
    throw new Error(messages.TEMPLATE_NOT_FOUND);
  }

  template.shared_to_organizations = isPublished ? organizationIds : [];
  template.is_published = isPublished;
  await template.save();

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const templateTitle = template.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      templateId,
      organizationIds,
      isPublished
    }),
    type: TemplateLogType.SHARE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) shared template ${templateTitle} to organizations`
    )
  });

  return template;
}

async function getSharedTemplates({
  user,
  org
}: {
  user: UserType;
  org: string;
}) {
  const organizationId = getOrgIdByOrgSlug({
    user,
    org
  });

  const templates = await Template.find({
    shared_to_organizations: { $in: organizationId },
    deleted_at: { $eq: null }
  }).populate('rubrics');

  return templates;
}

async function duplicateTemplate({
  templateId,
  user,
  orgSlug,
  reqAuth
}: {
  templateId: string;
  user: UserType;
  orgSlug: string;
  reqAuth: RequestAuth;
}) {
  const template = await Template.findById(templateId);

  if (!template) {
    throw new Error(messages.TEMPLATE_NOT_FOUND);
  }

  const organizationId = getOrgIdByOrgSlug({
    user,
    org: orgSlug
  });

  const newTemplate = await Template.create({
    ...template,
    title: template.title,
    description: template.description,
    characters: template.characters,
    environment: template.environment,
    service_type: template.service_type,
    rubrics: template.rubrics,
    time_limit: template.time_limit,
    form_questions: template.form_questions,
    form_questions_file: template.form_questions_file,
    master_template_id: templateId,
    is_master_template: false,
    is_published: false,
    creator: user._id,
    organization: organizationId
  });

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const templateTitle = newTemplate.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      orgSlug,
      templateId
    }),
    type: TemplateLogType.DUPLICATE,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) duplicated template ${templateTitle}`
    )
  });

  return newTemplate;
}

const publishTemplate = async (args: {
  templateId: string;
  user: UserType;
  reqAuth: RequestAuth;
  orgSlug: string;
}) => {
  const { templateId } = args;
  const { user, reqAuth, orgSlug } = args;

  const template = await Template.findById(templateId);

  if (!template) {
    throw new Error(messages.TEMPLATE_NOT_FOUND);
  }

  const organization = getOrgIdByOrgSlug({
    user,
    org: orgSlug
  });

  template.is_published = true;
  template.shared_to_organizations = [
    organization?._id as unknown as string
  ];
  await template.save();

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const templateTitle = template.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      templateId
    }),
    type: TemplateLogType.PUBLISH,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) published template ${templateTitle}`
    )
  });

  return template;
};

const unpublishTemplate = async (args: {
  templateId: string;
  user: UserType;
  reqAuth: RequestAuth;
}) => {
  const { templateId } = args;
  const { user, reqAuth } = args;

  const template = await Template.findById(templateId);

  if (!template) {
    throw new Error(messages.TEMPLATE_NOT_FOUND);
  }

  template.is_published = false;
  template.shared_to_organizations = [];
  await template.save();

  /** Log action */
  const userFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  const templateTitle = template.title;

  await logService.createLog({
    organization: reqAuth.membership.organization._id,
    payload_snapshot: logService.encryptPayloadSnapshot({
      templateId
    }),
    type: TemplateLogType.UNPUBLISH,
    activity: encryptFieldData(
      `${userFullName} (${userOrgName} ${reqAuth.role}) unpublished template ${templateTitle}`
    )
  });

  return template;
};

export default {
  getTemplates,
  getTemplateById,
  createTemplates,
  editTemplate,
  shareTemplateToOrganizations,
  getSharedTemplates,
  deleteTemplate,
  duplicateTemplate,
  publishTemplate,
  unpublishTemplate
};
