import mailConfig from '../config/mail.config';
import roles from '../constants/roles';

export function getAccountVerificationEmailData(args: {
  email: string;
  recipient: string;
  url: string;
  supportEmail?: string;
}) {
  const { email } = args;
  const { recipient, url } = args;
  const { supportEmail = mailConfig.supportEmail } = args;

  const emailPayload = {
    to: email,
    subject: 'Confirm Your Email Address'
  };
  const templateData = { recipient, url, supportEmail };
  const template = 'userEmailVerification';

  return { emailPayload, templateData, template };
}

export function getForgotPasswordEmailData(args: {
  email: string;
  recipient: string;
  url: string;
  supportEmail?: string;
}) {
  const { email } = args;
  const { recipient, url } = args;
  const { supportEmail = mailConfig.supportEmail } = args;

  const emailPayload = {
    to: email,
    subject: 'Reset Your Password'
  };
  const templateData = { recipient, url, supportEmail };
  const template = 'passwordResetEmail';

  return { emailPayload, templateData, template };
}

export function getApprovalEmailData(
  role: string,
  additionalData: {
    email: string;
    recipient: string;
    url: string;
    supportEmail?: string;
  }
) {
  const { email } = additionalData;
  const { recipient, url } = additionalData;
  const { supportEmail = mailConfig.supportEmail } = additionalData;

  if (role === roles.ADMIN) {
    const emailPayload = {
      to: email,
      subject: 'Welcome to Nudgyt!'
    };
    const templateData = { recipient, supportEmail };
    const template = 'adminApprovedMessage';

    return { emailPayload, templateData, template };
  }

  if (role === roles.TRAINER) {
    const emailPayload = {
      to: email,
      subject: 'Welcome to Nudgyt!'
    };
    const templateData = { recipient, url, supportEmail };
    const template = 'trainerApprovedMessage';

    return { emailPayload, templateData, template };
  }

  if (role === roles.LEARNER) {
    const emailPayload = {
      to: email,
      subject: 'Your Learning Journey Starts Now!'
    };
    const templateData = { recipient, url, supportEmail };
    const template = 'learnerApprovedMessage';

    return { emailPayload, templateData, template };
  }

  return null;
}

/** Corresponds to "Invitation to join organization" on Figma */
export function getJoinInvitationEmailData(
  type: 'new-user' | 'existing-user',
  role: string,
  additionalData: {
    email: string;
    orgName: string;
    recipient: string;
    url: string;
    supportEmail?: string;
  }
) {
  const { email } = additionalData;
  const { orgName, recipient, url } = additionalData;
  const { supportEmail = mailConfig.supportEmail } = additionalData;

  const buttonTitle =
    type === 'existing-user'
      ? 'Accept Invitation'
      : 'Join Organization';

  if (role === roles.ADMIN) {
    const emailPayload = {
      to: email,
      subject: `Join ${orgName} on Nudgyt`
    };
    const templateData = {
      subject: `You’re Invited to ${orgName}`,
      recipient,
      customMsg1: `You’ve been invited to join ${orgName} on Nudgyt! As part of this organization, you’ll gain access to exclusive tools and resources, including AI-powered services tailored for your organization.`,
      customMsg2:
        'Click below to accept the invitation and get started:',
      url,
      buttonTitle,
      customMsg3: `If you have any questions, contact the sender or reach out to us at ${supportEmail}.`,
      customMsg4: 'Welcome aboard!'
    };
    const template = 'joinInvitation';

    return { emailPayload, templateData, template };
  }

  if (role === roles.TRAINER) {
    const emailPayload = {
      to: email,
      subject: `Invitation to Train ${orgName} AI-Powered Services`
    };
    const templateData = {
      subject: `Join ${orgName} on Nudgyt`,
      recipient,
      customMsg1: `You’ve been invited to join ${orgName} on Nudgyt as a service Trainer. In this role, you’ll build and manage the AI-powered services to ensure it meets your organization’s needs.`,
      customMsg2: `Click below to accept the invitation and start managing the ${orgName} platform:`,
      url,
      buttonTitle,
      customMsg3: `If you have any questions, contact the sender or reach out to us at ${supportEmail}.`,
      customMsg4: 'Welcome aboard!'
    };
    const template = 'joinInvitation';

    return { emailPayload, templateData, template };
  }

  if (role === roles.LEARNER) {
    const emailPayload = {
      to: email,
      subject: `Join ${orgName} on Nudgyt`
    };
    const templateData = {
      subject: 'Start Your Training Journey',
      recipient,
      customMsg1: `You’ve been invited to join Nudgyt as a learner. By joining, you’ll gain access to exclusive simulations and bespoke training services tailored specifically for ${orgName}.`,
      customMsg2:
        'Click below to accept the invitation and get started:',
      url,
      buttonTitle,
      customMsg3: `If you have any questions, contact the sender or reach out to us at ${supportEmail}.`

      /** Design does not have this. Keeping this comment to explicitly note inconsistency */
      // customMsg4: 'Welcome aboard!'
    };
    const template = 'joinInvitation';

    return { emailPayload, templateData, template };
  }

  return null;
}

/** Corresponds to "Invitation to join" on Figma */
export function getPublicJoinInvitationEmailData(
  role: string,
  additionalData: {
    email: string;
    recipient: string;
    url: string;
    supportEmail?: string;
  }
) {
  const { email } = additionalData;
  const { recipient, url } = additionalData;
  const { supportEmail = mailConfig.supportEmail } = additionalData;

  if (role === roles.ADMIN) {
    const emailPayload = {
      to: email,
      subject: 'Invitation to Join as an Admin on Nudgyt'
    };
    const templateData = {
      subject: 'Your Admin Access Invitation',
      recipient,
      customMsg1:
        'You have been invited to join Nudgyt as an Administrator. This role grants you access to tools and features to effectively manage and oversee your team’s activities on the platform.',
      customMsg2:
        'To accept this invitation and activate your account, please use the link below:',
      url,
      buttonTitle: 'Accept Invitation and Sign Up', // For some reason this is different than the other templates
      customMsg3: `If you have any questions, contact the sender or reach out to us at ${supportEmail}.`
      // customMsg4: 'Welcome aboard!'
    };
    const template = 'joinInvitation';

    return { emailPayload, templateData, template };
  }

  if (role === roles.TRAINER) {
    const emailPayload = {
      to: email,
      subject: 'Invitation to Train AI-Powered Services'
    };
    const templateData = {
      subject: 'Your Trainer Invitation',
      recipient,
      customMsg1:
        'You’ve been invited to join Nudgyt as a service trainer. In this role, you’ll build and manage the interactive services that shape how AI-powered simulations engages Learners.',
      customMsg2:
        'Click below to accept the invitation and start creating:',
      url,
      buttonTitle: 'Accept Invitation',
      customMsg3: `If you have any questions, contact the sender or reach out to us at ${supportEmail}.`
      // customMsg4: 'Welcome aboard!'
    };
    const template = 'joinInvitation';

    return { emailPayload, templateData, template };
  }

  if (role === roles.LEARNER) {
    const emailPayload = {
      to: email,
      subject: 'Invitation to Join Nudgyt as a Learner'
    };
    const templateData = {
      subject: 'Start Your Training Journey',
      recipient,
      customMsg1:
        'You’ve been invited to join Nudgyt as a as a learner. As a learner, you’ll engage with interactive simulations designed to build your skills and enhance your training experience.',
      customMsg2:
        'Click below to accept the invitation and get started:',
      url,
      buttonTitle: 'Accept Invitation',
      customMsg3: `If you have any questions, contact the sender or reach out to us at ${supportEmail}.`
      // customMsg4: 'Welcome aboard!'
    };
    const template = 'joinInvitation';

    return { emailPayload, templateData, template };
  }

  return null;
}

/** Has no corresponding design on Figma */
export function getOwnerInvitationEmailData(
  type: 'basic' | 'enterprise',
  additionalData: {
    email: string;
    orgName: string;
    recipient: string;
    url: string;
    supportEmail?: string;
  }
) {
  const { email } = additionalData;
  const { orgName, recipient, url } = additionalData;
  const { supportEmail = mailConfig.supportEmail } = additionalData;

  if (type === 'basic') {
    const emailPayload = {
      to: email,
      subject: `${orgName} on Nudgyt`
    };
    const templateData = {
      subject: `${orgName} on Nudgyt`,
      recipient,
      customMsg1: `We would like to invite ${orgName} to join us on Nudgyt! As part of our platform, you’ll gain access to exclusive tools and resources, including AI-powered services tailored for your organization.`,
      customMsg2:
        'Click below to accept the invitation and get started:',
      url,
      buttonTitle: 'Accept Invitation',
      customMsg3: `If you have any questions, contact the sender or reach out to us at ${supportEmail}.`,
      customMsg4: 'Welcome aboard!'
    };
    const template = 'joinInvitation';

    return { emailPayload, templateData, template };
  }

  if (type === 'enterprise') {
    const emailPayload = {
      to: email,
      subject: `${orgName} AI Platform`
    };
    const templateData = {
      subject: `${orgName} AI Platform`,
      recipient,
      customMsg1: `Nudgyt welcomes ${orgName} to its own AI platform! Here, you have access to exclusive tools and resources, including AI-powered services tailored for your organization.`,
      customMsg2:
        'Click below to sign up on your platform and get started:',
      url,
      buttonTitle: 'Go To Platform',
      customMsg3: `If you have any questions, contact the sender or reach out to us at ${supportEmail}.`,
      customMsg4: 'Welcome aboard!'
    };
    const template = 'joinInvitation';

    return { emailPayload, templateData, template };
  }

  return null;
}
