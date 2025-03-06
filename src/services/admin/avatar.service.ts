import { uploadFile } from '../../helpers/uploads';
import Avatar, { AvatarType } from '../../models/avatar.model';

async function uploadAvatar(file: Express.Multer.File) {
  const url = await uploadFile({
    file,
    keyPrefix: 'avatars'
  });

  return url;
}

async function createAvatar(avatarData: AvatarType) {
  const avatar = await Avatar.create(avatarData);
  return avatar;
}

async function updateAvatar({
  avatarId,
  avatarData
}: {
  avatarId: string;
  avatarData: Partial<AvatarType>;
}) {
  const avatar = await Avatar.findById(avatarId);
  if (!avatar) throw Error('Avatar not found');

  const updatedAvatar = await Avatar.findByIdAndUpdate(
    avatarId,
    avatarData,
    { new: true }
  );
  return updatedAvatar;
}

async function deleteAvatar({ avatarId }: { avatarId: string }) {
  const avatar = await Avatar.findById(avatarId);
  if (!avatar) throw Error('Avatar not found');

  const updatedAvatar = await Avatar.findByIdAndUpdate(
    avatarId,
    { deleted_at: new Date() },
    { new: true }
  );

  return updatedAvatar;
}

async function getAvatars() {
  const avatars = await Avatar.find({ deleted_at: null });
  return avatars;
}

async function getAvatarById({ avatarId }: { avatarId: string }) {
  const avatar = await Avatar.findOne({
    _id: avatarId,
    deleted_at: null
  });

  return avatar;
}

export default {
  getAvatars,
  getAvatarById,
  createAvatar,
  updateAvatar,
  deleteAvatar,
  uploadAvatar
};
