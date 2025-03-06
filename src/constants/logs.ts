export const ServiceLogType = {
  CREATE: 'Create Service',
  UPDATE: 'Update Service',
  DELETE: 'Delete Service',
  PUBLISH: 'Publish Service',
  UNPUBLISH: 'Unpublish Service'
} as const;

export const TemplateLogType = {
  CREATE: 'Create Template',
  UPDATE: 'Update Template',
  DELETE: 'Delete Template',
  PUBLISH: 'Publish Template',
  UNPUBLISH: 'Unpublish Template',
  DUPLICATE: 'Duplicate Template',
  SHARE: 'Share Template'
} as const;

export const CharacterLogType = {
  CREATE: 'Create Character',
  UPDATE: 'Update Character',
  DELETE: 'Delete Character'
} as const;

export const SimulationLogType = {
  START: 'Start Simulation',
  FINISH: 'Finish Simulation',
  PAUSE: 'Pause Simulation',
  RESUME: 'Resume Simulation',
  CREATE_TRANSCRIPT: 'Create Transcript'
} as const;

export const UserLogType = {
  LOGIN: 'Login',
  APPROVE: 'Approve User',
  BLOCK: 'Block User',
  UNBLOCK: 'Unblock User',
  ARCHIVE: 'Archive User'
} as const;

export const InvitationLogType = {
  INVITE: 'Invite User',
  INVITE_EXISTING: 'Invite Existing User',
  INVITE_EXISTING_AS_OWNER: 'Invite Existing User As Owner',
  INVITE_OWNER: 'Invite Owner',
  INVITE_ENTERPRISE: 'Invite Enterprise',
  ACCEPT_INVITATION: 'Accept Invitation',
  DECLINE_INVITATION: 'Decline Invitation',
  ACCEPT_OWNER_INVITATION: 'Accept Owner Invitation',
  DECLINE_OWNER_INVITATION: 'Decline Owner Invitation'
} as const;

export const OrganizationLogType = {
  UPDATE_ORGANIZATION: 'Update Organization',
  UPDATE_ENTERPRISE: 'Update Enterprise',
  ADD_EXTRA_LEARNERS: 'Add Extra Learners'
} as const;
