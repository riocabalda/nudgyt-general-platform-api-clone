import express from 'express';
import transcriptController from '../../controllers/trainer/transcript.controller';
import transcriptValidation from '../../validations/transcript.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/:simulationId',
  transcriptController.getTranscriptsBySimulation
);
router.post(
  '/',
  transcriptValidation.createTranscript,
  transcriptController.createTranscript
);
router.post('/create-comment', transcriptController.createComment);
router.post('/delete-comment', transcriptController.deleteComment);

export default router;
