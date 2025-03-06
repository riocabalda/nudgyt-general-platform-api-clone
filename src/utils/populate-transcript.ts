import { decryptFieldData } from '../helpers/db';
import Transcript, {
  FROM_TO_TYPES,
  TranscriptType
} from '../models/transcript.model';
import User from '../models/user.model';

export async function populateTranscripts(
  transcripts: TranscriptType[]
) {
  return Promise.all(
    transcripts.map(async (transcript) => {
      if (
        transcript.from_type === FROM_TO_TYPES.USER &&
        transcript.from
      ) {
        return Transcript.populate(transcript, {
          path: 'from',
          select: 'fullname email name'
        });
      }
      return transcript;
    })
  );
}

export async function populateTranscriptsFullName(
  transcripts: TranscriptType[]
) {
  // Use Set for O(1) lookup and automatic deduplication
  const userIdSet = new Set<string>();

  // Collect all unique user IDs in a single pass
  transcripts.forEach(({ from, comments }) => {
    userIdSet.add(from?._id.toString() ?? '');
    comments.forEach(({ from_type, from }) => {
      if (from_type === FROM_TO_TYPES.USER && from) {
        userIdSet.add(from.toString());
      }
    });
  });

  // Convert Set to array for mongoose query
  const users = await User.find({
    _id: { $in: Array.from(userIdSet) }
  });

  // Create lookup map for decrypted names
  const decryptedUserIds = users.reduce<Record<string, string>>(
    (acc, user) => {
      acc[user._id.toString()] = decryptFieldData(user.full_name);
      return acc;
    },
    {}
  );

  // Transform transcripts with decrypted names
  return transcripts.map((transcript) => ({
    ...transcript,
    from: {
      ...transcript.from,
      full_name: decryptedUserIds[transcript.from?._id.toString() ?? '']
    },
    comments: transcript.comments.map(
      ({
        from_type,
        text,
        _id,
        created_at,
        updated_at,
        from
      }: any) => ({
        from_type,
        text,
        _id,
        created_at,
        updated_at,
        from: {
          full_name: decryptedUserIds[from?.toString() ?? '']
        }
      })
    )
  }));
}

export async function populateComments(transcripts: TranscriptType[]) {
  return Promise.all(
    transcripts.map(async (transcript) => {
      const commentsWithPopulatedFrom = await Promise.all(
        transcript.comments.map(async (comment) => {
          if (
            comment.from_type === FROM_TO_TYPES.USER &&
            comment.from
          ) {
            return Transcript.populate(comment, {
              path: 'comments.from',
              select: 'fullname email'
            });
          }
          return comment;
        })
      );

      return {
        ...transcript.toObject(),
        comments: commentsWithPopulatedFrom
      };
    })
  );
}
