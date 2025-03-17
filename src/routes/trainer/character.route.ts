import express from 'express';
import characterController from '../../controllers/trainer/character.controller';
import requirePermissions from '../../middlewares/require-permissions';
import characterValidation from '../../validations/trainer/character.validation';

const router = express.Router({ mergeParams: true });

router.get(
  '/',
  requirePermissions(['Character.View']),
  characterController.getCharacters
);
router.get(
  '/voice-types',
  requirePermissions(['Character.Voice.View']),
  characterController.getCharacterVoiceTypes
);
router.get(
  '/paginated',
  requirePermissions(['Character.View']),
  characterController.getPaginatedCharacters
);
router.get(
  '/available-languages',
  requirePermissions(['Character.Language.View']),
  characterController.getAvailableLanguages
);
router.get(
  '/:characterId',
  requirePermissions(['Character.View']),
  characterController.getCharacter
);
router.post(
  '/',
  requirePermissions(['Character.Create']),
  characterValidation.createCharacter,
  characterController.createCharacter
);
router.put(
  '/:characterId',
  requirePermissions(['Character.Update']),
  characterValidation.characterEditValidation,
  characterController.updateCharacter
);

export default router;
