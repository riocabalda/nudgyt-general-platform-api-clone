import asyncWrapper from '../../helpers/async-wrapper';
import createResponse from '../../utils/create-response';
import characterService from '../../services/character.service';

const getCharacterVoiceTypes = asyncWrapper(async (req, res, next) => {
  const voiceTypes = await characterService.getCharacterVoiceTypes();

  const response = createResponse({ data: voiceTypes });

  res.json(response);
});

export default {
  getCharacterVoiceTypes
};
