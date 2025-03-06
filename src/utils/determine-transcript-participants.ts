import mongoose from 'mongoose';
import Character from '../models/character.model';
import { FROM_TO_TYPES } from '../models/transcript.model';

async function determineTranscriptSenderObjectId(args: {
  fromType: 'user' | 'character';
  userId: string;
  personalityId: string;
  characterName: string;
}) {
  const { fromType, userId, personalityId, characterName } = args;

  if (fromType === 'user') {
    return new mongoose.Types.ObjectId(userId);
  }

  fromType satisfies 'character';

  // Check if personalityId is not empty before querying the database
  if (personalityId.trim() === '') {
    return null;
  }

  /** Find character by personality id */
  const characterDocById = await Character.findOne({
    personality_id: personalityId
  });
  if (characterDocById !== null) {
    return characterDocById._id;
  }

  /** As a fallback, find character by name */
  const characterDocByName = await Character.findOne({
    name: characterName
  });

  if (characterDocByName !== null) {
    return characterDocByName._id;
  }

  return null;
}

async function determineTranscriptRecipient(args: {
  fromType: 'user' | 'character';
  userId: string;
  personalityId: string;
}) {
  const { fromType, userId, personalityId } = args;

  if (fromType === 'character') {
    return {
      to_type: FROM_TO_TYPES.USER,
      to: new mongoose.Types.ObjectId(userId)
    };
  }

  fromType satisfies 'user';

  /** Find character by personality id */
  const characterDocById = await Character.findOne({
    personality_id: personalityId
  });

  return {
    to_type: FROM_TO_TYPES.CHARACTER,
    to: characterDocById?._id ?? null
  };
}

export {
  determineTranscriptSenderObjectId,
  determineTranscriptRecipient
};
