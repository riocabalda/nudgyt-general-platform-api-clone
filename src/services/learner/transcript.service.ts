import createHttpError from 'http-errors';
import mongoose from 'mongoose';
import { SimulationLogType } from '../../constants/logs';
import messages from '../../constants/response-messages';
import { decryptFieldData, encryptFieldData } from '../../helpers/db';
import { RequestAuth } from '../../middlewares/require-permissions';
import Organization from '../../models/organization.model';
import Simulation from '../../models/simulation.model';
import Transcript from '../../models/transcript.model';
import { UserType } from '../../models/user.model';
import {
  determineTranscriptRecipient,
  determineTranscriptSenderObjectId
} from '../../utils/determine-transcript-participants';
import { generateLogDetails } from '../../utils/generate-log-details';
import { getOrgIdByOrgSlug } from '../../utils/get-org-id-by-org-slug';
import {
  populateComments,
  populateTranscriptsFullName
} from '../../utils/populate-transcript';
import logService from '../log.service';

async function createTranscript({
  user,
  org,
  fromType,
  simulationId,
  dialogueValue,
  personalityId,
  characterName,
  reqAuth
}: {
  user: UserType;
  org: string;
  fromType: 'user' | 'character';
  simulationId: string;
  dialogueValue: string;
  personalityId: string;
  characterName: string;
  reqAuth: RequestAuth;
}) {
  const existingSimulation = await Simulation.findById(simulationId);

  if (!existingSimulation) {
    throw createHttpError.NotFound(messages.SIMULATION_NOT_FOUND);
  }

  const from = await determineTranscriptSenderObjectId({
    fromType,
    userId: user._id,
    personalityId,
    characterName
  });
  const { to, to_type } = await determineTranscriptRecipient({
    fromType,
    userId: user._id,
    personalityId
  });

  const newTranscript = await Transcript.create({
    from,
    simulation: existingSimulation._id,
    from_type: fromType,
    dialogue_value: dialogueValue,
    to,
    to_type
  });

  const actorUserFullName = decryptFieldData(user.full_name);
  const userOrgName = decryptFieldData(
    reqAuth.membership.organization.name
  );

  await logService.createLog({
    organization: getOrgIdByOrgSlug({ user, org }),
    payload_snapshot: logService.encryptPayloadSnapshot({
      actor_user_id: user._id
    }),
    type: SimulationLogType.CREATE_TRANSCRIPT,
    activity: encryptFieldData(
      generateLogDetails({
        actor: `${actorUserFullName} (${userOrgName} ${reqAuth.role})`,
        target: `${existingSimulation._id}`,
        type: 'created transcript'
      })
    )
  });

  return newTranscript;
}

async function getTranscriptBySimulationId(simulationId: string) {
  const transcripts = await Transcript.find({
    simulation: simulationId
  })
    .populate({
      path: 'from',
      select: 'fullname email name'
    })
    .populate({
      path: 'to',
      select: 'fullname name'
    });

  const fullyPopulatedTranscripts = await populateComments(transcripts);
  const populatedTranscripts = await populateTranscriptsFullName(
    fullyPopulatedTranscripts
  );
  return populatedTranscripts;
}

async function createComment({
  orgSlug,
  userId,
  transcriptId,
  text
}: {
  orgSlug: string;
  userId: string;
  transcriptId: string;
  text: string;
}) {
  if (!orgSlug) {
    throw createHttpError.Conflict('Organization Slug is required');
  }
  const orgSlugHash = encryptFieldData(orgSlug);

  const organization = await Organization.findOne({
    'slug.hash': orgSlugHash.hash
  });

  if (!organization) {
    throw createHttpError.Conflict('Organization not found');
  }

  const transcript = await Transcript.findById(transcriptId);
  if (transcript === null) throw createHttpError.NotFound();
  if (transcript.from_type !== 'user')
    throw createHttpError.BadRequest();

  transcript.comments.push({
    from_type: 'user',
    from: new mongoose.Types.ObjectId(userId),
    text
  });

  await transcript.save();
}

async function deleteComment({
  transcriptId,
  commentId,
  userId,
  orgSlug
}: {
  transcriptId: string;
  commentId: string;
  userId: string;
  orgSlug: string;
}) {
  if (!orgSlug) {
    throw createHttpError.Conflict('Organization Slug is required');
  }
  const orgSlugHash = encryptFieldData(orgSlug);

  const organization = await Organization.findOne({
    'slug.hash': orgSlugHash.hash
  });

  if (!organization) {
    throw createHttpError.Conflict('Organization not found');
  }

  const transcript = await Transcript.findById(transcriptId);
  if (transcript === null) throw createHttpError.NotFound();
  if (transcript.from_type !== 'user')
    throw createHttpError.BadRequest();

  const comment = transcript.comments.find(
    (c: any) => c?._id.toString() === commentId
  );
  if (!comment) throw createHttpError.NotFound();
  if (comment.from_type !== 'user') throw createHttpError.BadRequest();
  if (!comment.from?.equals(userId)) throw createHttpError.Forbidden();

  transcript.comments = transcript.comments.filter(
    (c: any) => c?._id.toString() !== commentId
  );

  await transcript.save();
}

export default {
  createTranscript,
  getTranscriptBySimulationId,
  createComment,
  deleteComment
};
