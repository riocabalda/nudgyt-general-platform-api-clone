import asyncWrapper from '../../helpers/async-wrapper';
import globalCharacterService from '../../services/character.service';
import characterService from '../../services/trainer/character.service';
import createResponse from '../../utils/create-response';

const getPaginatedCharacters = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const { search, page, limit, filter } = req.query as {
    search: string;
    page: string;
    limit: string;
    filter: string;
  };

  const characters = await characterService.getPaginatedCharacters({
    orgSlug: org,
    search,
    page: Number(page) || 1,
    limit: Number(limit) || 10,
    filter
  });

  res.status(200).json({
    data: characters
  });
});

const getCharacter = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const { characterId } = req.params;

  const character = await characterService.getCharacter({
    orgSlug: org,
    characterId
  });

  res.status(200).json({
    data: character
  });
});

const updateCharacter = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const { characterId } = req.params;
  const { body } = req;

  const updatedCharacter = await characterService.updateCharacter({
    orgSlug: org,
    characterId,
    body,
    user: req.user,
    reqAuth: req.auth
  });

  res.status(200).json(updatedCharacter);
});

const getCharacters = asyncWrapper(async (req, res, next) => {
  const { search } = req.query;
  const { org } = req.params;

  const characters = await characterService.getCharacters({
    search: search as string,
    orgSlug: org
  });

  const response = createResponse({ data: characters });

  res.json(response);
});

const createCharacter = asyncWrapper(async (req, res, next) => {
  const { org } = req.params;
  const characterData = req.body;
  const user = req.user;

  const character = await characterService.createCharacter({
    org,
    user,
    characterData,
    reqAuth: req.auth
  });

  const response = createResponse({ data: character });

  res.json(response);
});

const getCharacterVoiceTypes = asyncWrapper(async (req, res, next) => {
  const voiceTypes =
    await globalCharacterService.getCharacterVoiceTypes();

  const response = createResponse({ data: voiceTypes });

  res.json(response);
});

const getAvailableLanguages = asyncWrapper(async (req, res, next) => {
  const availableLanguages =
    await characterService.getAvailableLanguages();

  const response = createResponse({ data: availableLanguages });

  res.json(response);
});

export default {
  createCharacter,
  getCharacters,
  getCharacterVoiceTypes,
  getPaginatedCharacters,
  getCharacter,
  updateCharacter,
  getAvailableLanguages
};
