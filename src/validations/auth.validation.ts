import z from 'zod';
import { validateRequest } from 'zod-express-middleware';
import roles from '../constants/roles';
import { ZodDateISOString } from '../utils/zod';

export const SanitizedOrganizationSchema = z.object({
  _id: z.coerce.string(),
  name: z.string(),
  slug: z.string(),
  // code: z.never(),

  logo: z.string().optional().nullable(),

  created_at: ZodDateISOString,
  updated_at: ZodDateISOString
});

/**
 * Must be updated when user model/type changes
 *
 * Absence of fields means they will not be present after parsing
 * Commented out fields are included for completion
 *
 * Use custom Zod schema for dates to coerce to ISO strings like `JSON.stringify()`
 */
export const SanitizedUserSchema = z.object({
  _id: z.coerce.string(),
  full_name: z.string(),
  email: z.string(),
  // password: z.never(),
  is_guest: z.boolean(),
  is_super_admin: z.boolean().optional().nullable(),
  verification_token: z.string().nullable(),

  organizations: z
    .object({
      _id: z.coerce.string(),

      organization: SanitizedOrganizationSchema,
      roles: z.string().array(),
      is_owner: z.boolean(),

      status: z.string(),

      approved_at: ZodDateISOString.optional().nullable(),
      blocked_at: ZodDateISOString.optional().nullable(),

      created_at: ZodDateISOString,
      updated_at: ZodDateISOString
    })
    .array()
    .optional(),

  pending_organizations: z
    .object({
      _id: z.coerce.string(),
      name: z.string()
    })
    .array()
    .optional(),

  email_verified_at: ZodDateISOString.nullable(),
  deleted_at: ZodDateISOString.nullable(),
  archived_at: ZodDateISOString.nullable(),
  last_logged_in_at: ZodDateISOString.nullable(),

  created_at: ZodDateISOString,
  updated_at: ZodDateISOString
});

/**
 * - Remove verification token
 * - Add service count
 */
export const PaginatedUserSchema = SanitizedUserSchema.omit({
  verification_token: true
}).extend({
  services: z.number().nullable()
});

export const AccessTokenSchema = z.object({
  userId: z.string()
});
export const RefreshTokenSchema = z.object({
  /** ID in database */
  id: z.string()
});

export const InvitationTypeSchema = z
  .enum([
    'enterprise-organization-owner',
    'basic-organization-owner',
    'organization-user',
    'public-user'
  ])
  .optional();
export const InvitationTokenSchema = z.object({
  email: z.string().email(),
  role: z.string(),
  organization_id: z.string(),
  type: InvitationTypeSchema
});
export const PasswordResetTokenSchema = z.object({
  email: z.string().email()
});

export const RegisterSchema = z.object({
  full_name: z.string(),
  email: z.string().email(),
  organization_name: z.string().nullable(),
  organization_code: z.string().nullable(),
  password: z.string().min(6).max(32),
  confirm_password: z.string().min(6).max(32),
  role: z.enum([
    roles.LEARNER,
    roles.TRAINER,
    roles.ADMIN,
    'Organization'
  ]),
  is_guest: z.boolean().default(true),
  invitation_token: z.string().optional(),
  isTermsAndConditionsAccepted: z.boolean()
});
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});
export const UpdateUserDetailsSchema = z.object({
  full_name: z.string().optional()
});
export const VerifyEmailSchema = z.object({
  verification_token: z.string()
});
export const ResendEmailVerificationSchema = z.object({
  email: z.string().email()
});
export const ForgotPasswordSchema = z.object({
  email: z.string().email()
});
export const ResetPasswordSchema = z.object({
  token: z.string(),
  password: z.string(),
  confirm_password: z.string()
});
export const UpdatePasswordSchema = z.object({
  current_password: z.string(),
  password: z.string(),
  confirm_password: z.string()
});

const register = validateRequest({
  body: RegisterSchema
});
const login = validateRequest({
  body: LoginSchema
});
const updateUserDetails = validateRequest({
  body: UpdateUserDetailsSchema
});
const verifyEmail = validateRequest({
  body: VerifyEmailSchema
});
const resendEmailVerification = validateRequest({
  body: ResendEmailVerificationSchema
});
const forgotPassword = validateRequest({
  body: ForgotPasswordSchema
});
const resetPassword = validateRequest({
  body: ResetPasswordSchema
});
const updatePassword = validateRequest({
  body: UpdatePasswordSchema
});

export default {
  register,
  login,
  updateUserDetails,
  verifyEmail,
  resendEmailVerification,
  forgotPassword,
  resetPassword,
  updatePassword
};
