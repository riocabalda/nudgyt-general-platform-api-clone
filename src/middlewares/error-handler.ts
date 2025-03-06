import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { MulterError } from 'multer';
import uploaderConfig from '../config/uploader.config';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.log(error);

  const response: { message: string; errors?: any } = {
    message: error.message || 'Something went wrong!'
  };

  if (error instanceof MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      const maxFileSize = uploaderConfig.MAX_FILE_SIZE;
      response.message = `File size exceeds the allowed limit of ${maxFileSize}MB.`;

      return res.status(StatusCodes.REQUEST_TOO_LONG).json(response);
    }

    response.message = error.message;

    return res.status(StatusCodes.BAD_REQUEST).json(response);
  }

  if (error.errors) {
    response.errors = error.errors;
  }

  return res
    .status(error.status || StatusCodes.INTERNAL_SERVER_ERROR)
    .json(response);
};
