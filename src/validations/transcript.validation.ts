import z from 'zod';
import { validateRequest } from 'zod-express-middleware';
import { FROM_TO_TYPES } from '../models/transcript.model';

export const CreateTranscriptSchema = z.object({
  fromType: z.enum([FROM_TO_TYPES.USER, FROM_TO_TYPES.CHARACTER]),
  simulationId: z.string(),
  dialogueValue: z.string(),
  personalityId: z.string(),
  characterName: z.string()
});

const createTranscript = validateRequest({
  params: z.object({
    org: z.string()
  }),
  body: CreateTranscriptSchema
});

const getTranscriptsBySimulationId = validateRequest({
  params: z.object({
    id: z.string()
  })
});

export default {
  createTranscript,
  getTranscriptsBySimulationId
};
