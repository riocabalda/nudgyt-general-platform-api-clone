import Avatar from '../../models/avatar.model';

async function getAvatars() {
  const avatars = await Avatar.find();
  return avatars;
}

async function getAvatarById({ avatarId }: { avatarId: string }) {
  const avatar = await Avatar.findById(avatarId);
  return avatar;
}

export default {
  getAvatars,
  getAvatarById
};
