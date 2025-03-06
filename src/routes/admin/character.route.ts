import express from 'express';
import characterController from '../../controllers/admin/character.controller';
import requirePermissions from '../../middlewares/require-permissions';
import characterValidation from '../../validations/admin/character.validation';

const router = express.Router({ mergeParams: true });

router.get('/', characterController.getCharacters);
router.get('/voice-types', characterController.getCharacterVoiceTypes);
router.get('/paginated', characterController.getPaginatedCharacters);
router.get(
  '/available-languages',
  characterController.getAvailableLanguages
);
router.get('/:characterId', characterController.getCharacter);

router.post(
  '/',
  requirePermissions(['CREATE_CHARACTERS']),
  characterValidation.createCharacter,
  characterController.createCharacter
);

router.put(
  '/:characterId',
  requirePermissions(['UPDATE_CHARACTERS']),
  characterValidation.characterEditValidation,
  characterController.updateCharacter
);

export default router;
