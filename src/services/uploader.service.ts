import fs from 'fs';
import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import uploaderConfig from '../config/uploader.config';

type FileTypeConfig = {
  fieldName: string;
  allowedTypes: string[];
  maxCount?: number;
  destination: string;
};

type UploaderOptions = {
  fileTypes: FileTypeConfig[];
  maxFileSize?: number;
};

type StorageType = 'disk' | 'memory';

const createUploader = (options: UploaderOptions) => {
  options.maxFileSize ??= uploaderConfig.MAX_FILE_SIZE;

  const createDiskStorage = () =>
    multer.diskStorage({
      destination: (req, file, cb) => {
        const fileTypeConfig = options.fileTypes.find(
          (ft) => ft.fieldName === file.fieldname
        );
        const destination =
          fileTypeConfig?.destination || 'public/uploads/';

        // Create the directory if it doesn't exist
        fs.mkdirSync(destination, { recursive: true });

        cb(null, destination);
      },
      filename: (req, file, cb) => {
        const originalName = path.basename(
          file.originalname,
          path.extname(file.originalname)
        );
        const timestamp = Date.now();
        const fileName = `${originalName}-${timestamp}${path.extname(
          file.originalname
        )}`;
        cb(null, fileName);
      }
    });

  const createStorage = (type: StorageType) => {
    if (type === 'disk') {
      return createDiskStorage();
    }
    if (type === 'memory') {
      return multer.memoryStorage();
    }

    throw new Error('Unknown storage type');
  };

  const fileFilter = (
    req: Express.Request,
    file: Express.Multer.File,
    cb: FileFilterCallback
  ) => {
    const fileTypeConfig = options.fileTypes.find(
      (ft) => ft.fieldName === file.fieldname
    );
    if (
      fileTypeConfig &&
      fileTypeConfig.allowedTypes.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type for ${
            file.fieldname
          }. Allowed types: ${fileTypeConfig?.allowedTypes.join(', ')}`
        )
      );
    }
  };

  const upload = (storage: StorageType) =>
    multer({
      storage: createStorage(storage),
      fileFilter,
      limits: { fileSize: options.maxFileSize }
    });

  const singleUpload = (fieldName: string) => {
    return upload('disk').single(fieldName);
  };

  const multiUpload = () => {
    const fields = options.fileTypes.map((ft) => ({
      name: ft.fieldName,
      maxCount: ft.maxCount || 1
    }));

    return upload('disk').fields(fields);
  };

  const memoryUpload = () => {
    const fields = options.fileTypes.map((ft) => ({
      name: ft.fieldName,
      maxCount: ft.maxCount || 1
    }));

    return upload('memory').fields(fields);
  };

  return {
    single: singleUpload,
    multi: multiUpload,
    memory: memoryUpload
  };
};

export default {
  createUploader
};
