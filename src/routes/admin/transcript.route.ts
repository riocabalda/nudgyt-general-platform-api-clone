import express from 'express';
import transcriptController from '../../controllers/admin/transcript.controller';
import transcriptValidation from '../../validations/transcript.validation';
import requirePermissions from '../../middlewares/require-permissions';

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
router.post('/create-comment', requirePermissions(['Transcript.Comment.Create']), transcriptController.createComment);
router.post('/delete-comment', requirePermissions(['Transcript.Comment.Delete']), transcriptController.deleteComment);

export default router;
