import mime from 'mime-types';
import DOSpacesService from '../services/do-spaces.service';

type FilenameType = 'timestamp' | 'keep';

/** Timestamp + unique ID */
function createTimestampFilename(file: Express.Multer.File) {
  const timestamp = Date.now();
  const uuid = crypto.randomUUID();

  const basename = `${timestamp}_${uuid}`;
  const ext = mime.extension(file.mimetype);

  const filename = `${basename}.${ext}`;

  return filename;
}

function createFilename(
  file: Express.Multer.File,
  filenameType: FilenameType = 'timestamp'
) {
  if (filenameType === 'timestamp')
    return createTimestampFilename(file);

  if (filenameType === 'keep') return file.originalname;

  filenameType satisfies never;
  throw new Error('Unknown filename type');
}

export async function uploadFile(args: {
  file: Express.Multer.File;
  keyPrefix: string;
  filenameType?: FilenameType;
}) {
  const { file, keyPrefix, filenameType } = args;

  const filename = createFilename(file, filenameType);

  const key = DOSpacesService.createKey(`/${keyPrefix}/${filename}`);
  const url = await DOSpacesService.upload(
    file.buffer,
    file.mimetype,
    key
  );

  return url;
}
