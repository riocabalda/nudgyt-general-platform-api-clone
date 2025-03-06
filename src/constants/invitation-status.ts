export type InvitationStatus = (typeof INVITATION_STATUS)[number];

const invitationStatus = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined'
} as const;
export const INVITATION_STATUS = Object.values(invitationStatus);

export default invitationStatus;
