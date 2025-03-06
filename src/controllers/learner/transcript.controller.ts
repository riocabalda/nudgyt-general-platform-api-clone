import asyncWrapper from '../../helpers/async-wrapper';
import transcriptService from '../../services/learner/transcript.service';
import createResponse from '../../utils/create-response';

const createTranscript = asyncWrapper(async (req, res) => {
  const user = req.user;
  const { org } = req.params;
  const { fromType, simulationId, dialogueValue } = req.body;
  const { personalityId, characterName } = req.body;

  const transcript = await transcriptService.createTranscript({
    dialogueValue,
    fromType,
    simulationId,
    user,
    org,
    personalityId,
    characterName,
    reqAuth: req.auth
  });

  const response = createResponse({
    data: transcript
  });
  res.json(response);
});

const getTranscriptsBySimulationId = asyncWrapper(async (req, res) => {
  const simulationId = req.params.id;

  const transcripts =
    await transcriptService.getTranscriptBySimulationId(simulationId);

  const response = createResponse({
    data: transcripts
  });
  res.json(response);
});

const createComment = asyncWrapper(async (req, res, next) => {
  const learnerId = req.user._id;
  const { org } = req.params;
  const { transcriptId, text } = req.body;
  const comment = await transcriptService.createComment({
    orgSlug: org,
    userId: learnerId,
    transcriptId,
    text
  });

  const response = createResponse({ data: comment });

  res.json(response);
});

const deleteComment = asyncWrapper(async (req, res, next) => {
  const learnerId = req.user._id;
  const { org } = req.params;
  const { transcriptId, commentId } = req.body;
  await transcriptService.deleteComment({
    transcriptId,
    commentId,
    userId: learnerId,
    orgSlug: org
  });

  res.json({ message: 'Comment deleted successfully' });
});

export default {
  createTranscript,
  getTranscriptsBySimulationId,
  createComment,
  deleteComment
};
