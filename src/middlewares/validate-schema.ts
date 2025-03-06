import { Request, Response, NextFunction } from 'express';
import createHttpError from 'http-errors';
import { Schema } from 'zod';

export const validateSchema = (schema: Schema<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.safeParse(req.body);
    if (error) {
      return next(createHttpError(400, { errors: error.errors }));
    }
    next();
  };
};
