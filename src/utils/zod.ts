import mongoose from 'mongoose';
import z from 'zod';

export const ZodObjectId = z
  .custom(
    (value) => mongoose.Types.ObjectId.isValid(value) // Check if valid
  )
  .transform(
    (value: any) => new mongoose.Types.ObjectId(value) // Coerce to ObjectId
  );

export const ZodDateISOString = z
  .date()
  .transform((date) => date.toISOString());
