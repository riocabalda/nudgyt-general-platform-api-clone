import express from 'express';
import transcriptController from '../../controllers/learner/transcript.controller';
import requirePermissions from '../../middlewares/require-permissions';
import transcriptValidation from '../../validations/transcript.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/:id',
  transcriptValidation.getTranscriptsBySimulationId,
  transcriptController.getTranscriptsBySimulationId
);

router.post(
  '/',
  requirePermissions(['CREATE_TRANSCRIPTS']),
  transcriptValidation.createTranscript,
  transcriptController.createTranscript
);

router.post('/create-comment', transcriptController.createComment);
router.post('/delete-comment', transcriptController.deleteComment);

export default router;
