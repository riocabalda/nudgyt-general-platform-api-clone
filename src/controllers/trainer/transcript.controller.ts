import asyncWrapper from '../../helpers/async-wrapper';
import transcriptsService from '../../services/trainer/transcript.service';
import createResponse from '../../utils/create-response';

const createTranscript = asyncWrapper(async (req, res) => {
  const user = req.user;
  const { org } = req.params;
  const { fromType, simulationId, dialogueValue } = req.body;
  const { personalityId, characterName } = req.body;

  const transcript = await transcriptsService.createTranscript({
    dialogueValue,
    fromType,
    simulationId,
    user,
    org,
    personalityId,
    characterName
  });

  const response = createResponse({
    data: transcript
  });
  res.json(response);
});

const getTranscriptsBySimulation = asyncWrapper(
  async (req, res, next) => {
    const { simulationId, org } = req.params;
    const transcripts =
      await transcriptsService.getTranscriptsBySimulation({
        simulationId,
        orgSlug: org
      });

    const response = createResponse({ data: transcripts });

    res.json(response);
  }
);

const createComment = asyncWrapper(async (req, res, next) => {
  const userId = req.user._id;
  const { org } = req.params;
  const { transcriptId, text } = req.body;
  const comment = await transcriptsService.createComment({
    orgSlug: org,
    userId,
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
  await transcriptsService.deleteComment({
    transcriptId,
    commentId,
    userId: learnerId,
    orgSlug: org
  });

  res.json({ message: 'Comment deleted successfully' });
});

export default {
  createTranscript,
  getTranscriptsBySimulation,
  createComment,
  deleteComment
};
