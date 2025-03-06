import z from 'zod';
import { validateRequest } from 'zod-express-middleware';

export const CharacterValidationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.string().min(1, 'Age is required'),
  languages: z
    .array(z.string())
    .min(1, 'At least one language is required'),
  voice_type: z.string().min(1, 'Voice type is required'),
  backstory: z
    .string()
    .min(1, 'Backstory must be at least 10 characters'),
  hidden_backstory: z
    .string()
    .min(1, 'Hidden backstory must be at least 10 characters'),
  personality: z.object({
    openess: z.string(),
    meticulousness: z.string(),
    extraversion: z.string(),
    agreeableness: z.string(),
    sensitivity: z.string()
  })
});

const characterEditValidation = validateRequest({
  body: CharacterValidationSchema
});

const PersonalitySchema = z.object({
  openess: z.string().optional(),
  meticulousness: z.string().optional(),
  extraversion: z.string().optional(),
  agreeableness: z.string().optional(),
  sensitivity: z.string().optional()
});

export const CreateCharacterSchema = z.object({
  avatar: z.string(),
  name: z.string(),
  age: z.string(),
  voice_type: z.string(),
  languages: z.array(z.string()),
  backstory: z.string(),
  hidden_backstory: z.string(),
  personality: PersonalitySchema.optional()
});

const createCharacter = validateRequest({
  body: CreateCharacterSchema
});

export default {
  createCharacter,
  characterEditValidation
};
