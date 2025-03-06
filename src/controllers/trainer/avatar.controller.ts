import asyncWrapper from '../../helpers/async-wrapper';
import avatarService from '../../services/trainer/avatar.service';
import createResponse from '../../utils/create-response';

const getAvatars = asyncWrapper(async (req, res, next) => {
  const avatars = await avatarService.getAvatars();

  const response = createResponse({ data: avatars });

  res.json(response);
});

const getAvatarById = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  const avatar = await avatarService.getAvatarById({
    avatarId: id
  });

  const response = createResponse({ data: avatar });

  res.json(response);
});

export default {
  getAvatars,
  getAvatarById
};
