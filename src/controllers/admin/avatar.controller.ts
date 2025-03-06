import asyncWrapper from '../../helpers/async-wrapper';
import avatarService from '../../services/admin/avatar.service';
import createResponse from '../../utils/create-response';

const createAvatar = asyncWrapper(async (req, res, next) => {
  const avatarData = req.body;
  const filesObj = Array.isArray(req.files) ? undefined : req.files;
  const imageFile = filesObj?.image?.[0];

  let file: string | undefined;
  if (imageFile !== undefined) {
    file = await avatarService.uploadAvatar(imageFile);
  }

  const avatar = await avatarService.createAvatar({
    ...avatarData,
    image_path: file
  });

  const response = createResponse({ data: avatar });

  res.json(response);
});

const updateAvatar = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;
  const avatarData = req.body;
  const filesObj = Array.isArray(req.files) ? undefined : req.files;
  const imageFile = filesObj?.image?.[0];

  let file: string | undefined;
  if (imageFile !== undefined) {
    file = await avatarService.uploadAvatar(imageFile);
  }

  const avatar = await avatarService.updateAvatar({
    avatarId: id,
    avatarData: {
      ...avatarData,
      image_path: file
    }
  });

  const response = createResponse({ data: avatar });

  res.json(response);
});

const deleteAvatar = asyncWrapper(async (req, res, next) => {
  const { id } = req.params;

  await avatarService.deleteAvatar({ avatarId: id });

  const response = createResponse({
    message: 'Avatar deleted successfully'
  });

  res.json(response);
});

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
  getAvatarById,
  createAvatar,
  updateAvatar,
  deleteAvatar
};
