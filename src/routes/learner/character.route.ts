import express from 'express';
import characterController from '../../controllers/learner/character.controller';

const router = express.Router({ mergeParams: true });

router.get('/voice-types', characterController.getCharacterVoiceTypes);

export default router;
