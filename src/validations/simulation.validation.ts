import { validateRequest } from 'zod-express-middleware';
import { z } from 'zod';

const FormAnswersSchema = z.object({
  section: z.string(),
  question_no: z.string(),
  answer: z.string()
});

const SectionScoreSchema = z.object({
  section: z.string(),
  score: z.number(),
  correct: z.number(),
  total: z.number()
});

const SimulationResultSchema = z.object({
  section_score: z.array(SectionScoreSchema),
  overall_score: z.number(),
  overall_correct: z.number(),
  overall_total: z.number()
});

const SimulationSchema = z.object({
  learner: z.string().optional(),
  service: z.string().optional(),
  service_level: z.string().optional(),
  form_answers: z.array(FormAnswersSchema).optional(),
  started_at: z.date().nullable().optional(),
  ended_at: z.date().nullable().optional(),
  cancelled_at: z.date().nullable().optional(),
  simulation_result: SimulationResultSchema.optional()
});

const SectionSchema = z.record(z.string());

const FormAnswerSchema = z.record(SectionSchema);

const startSimulation = validateRequest({
  body: SimulationSchema
});

const getSimulationById = validateRequest({
  params: z.object({
    id: z.string()
  })
});

const stopSimulation = validateRequest({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    formAnswers: FormAnswerSchema
  })
});

const resumeSimulation = validateRequest({
  params: z.object({
    id: z.string()
  })
});

const pauseSimulation = validateRequest({
  params: z.object({
    id: z.string()
  })
});

const updateFormAnswers = validateRequest({
  params: z.object({
    id: z.string()
  }),
  body: z.object({
    formAnswers: FormAnswerSchema
  })
});

const getPreviousAttemptSimulations = validateRequest({
  query: z.object({
    page: z.string().optional(),
    service_id: z.string().optional()
  })
});

export default {
  startSimulation,
  stopSimulation,
  resumeSimulation,
  pauseSimulation,
  getSimulationById,
  updateFormAnswers,
  getPreviousAttemptSimulations
};
