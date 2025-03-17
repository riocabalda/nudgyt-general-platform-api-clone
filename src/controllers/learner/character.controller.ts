import asyncWrapper from '../../helpers/async-wrapper';
import createResponse from '../../utils/create-response';
import globalCharacterService from '../../services/character.service';

const getCharacterVoiceTypes = asyncWrapper(async (req, res, next) => {
  const voiceTypes = await globalCharacterService.getConvaiVoiceTypes();

  const response = createResponse({ data: voiceTypes });

  res.json(response);
});

export default {
  getCharacterVoiceTypes
};
