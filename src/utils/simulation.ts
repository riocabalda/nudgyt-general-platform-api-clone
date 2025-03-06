import z from 'zod';
import { ServiceLevelType } from '../models/service-level.model';
import { SimulationType } from '../models/simulation.model';

const SoftSkillSchema = z.enum([
  'Empathy',
  'Active Listening',
  'Adaptability',
  'Respectfulness',
  'Problem Solving',
  'Reasoning'
]);

type DisplaySectionScore = {
  name: string;
  score: number;
  total: number;
  showScore: boolean;
  showAnswers: boolean;
};

export type SoftSkill = z.infer<typeof SoftSkillSchema>;

export type SoftSkillRating = {
  skill: string;
  score: number;
  total: number;
  description: string;
  importance: string;
  assessment: string[];
};

export type SoftSkillsData = {
  summary: string;
  ratings: SoftSkillRating[];
};

export type DisplayScores = {
  overall: {
    score: number;
    total: number;
    percentage: number;
  };
  sections: DisplaySectionScore[];
};

type Section = string;
type SectionScoreRecord = Record<Section, DisplaySectionScore>;

export const SKILL_IMPORTANCE: Record<string, string> = {
  Empathy:
    'Helps in building trust and making the elderly feel understood and valued',
  'Active Listening':
    'Ensures that the needs, concerns, and preferences of the elderly are heard and addressed',
  Adaptability:
    'Helps caregivers provide consistent, high-quality care even as circumstances change',
  Respectfulness:
    "Fosters a positive environment and enhances the residents' sense of self-worth",
  'Problem Solving':
    'Helps in effectively addressing and managing any challenges that arise',
  Reasoning:
    'Learners are able to think through why they chose various options for coding'
} satisfies Record<SoftSkill, string>;

export const SKILL_ASSESSMENT_RUBRICS: Record<string, string[]> = {
  Empathy: [
    "Learner is able to describe residents' feelings",
    'Learner regularly checks in on emotional well-being'
  ],
  'Active Listening': [
    'Learner asks clarifying questions or expounds on what residents are saying',
    'Learner avoids interrupting or changing subjects while residents are speaking'
  ],
  Adaptability: [
    'Learners ask questions that are appropriate to the flow of the conversation rather than the order the questions are in'
  ],
  Respectfulness: [
    'Learner uses respectful language',
    "Learner honors residents' preferences for issues they don't wish to discuss"
  ],
  'Problem Solving': [
    'Learner is able to de-escalate conflicts',
    'Learner is able to direct conversations to be back on track'
  ],
  Reasoning: [
    'Learners use the notes to give justification for their coding in a thought out manner'
  ]
} satisfies Record<SoftSkill, string[]>;

export const RawSkillRegex =
  /^(?<raw_skill>.*?): (?<score>\d*?)\/(?<total>\d*)$/;
export const RawSkillRegexSchema = z.object({
  raw_skill: z.string(),
  score: z.coerce.number(),
  total: z.coerce.number()
});

export const checkPropertyExistence = (
  formAnswer: any,
  propertyPath: string[]
): boolean => {
  let current: any = formAnswer;

  for (let key of propertyPath) {
    if (
      current !== null &&
      typeof current === 'object' &&
      key in current
    ) {
      current = current[key];
    } else {
      return false;
    }
  }

  return true;
};

/** Splits e.g. `"A. Identification Information"` to `["A", "Identification Information"]` */
function splitSectionName(section: string) {
  const parts = section.split('. ');
  if (parts.length !== 2) {
    console.warn('Section name has more parts than expected...?');
  }

  return parts;
}

export function getSimulationScore(
  serviceLevelData: ServiceLevelType,
  simulation: SimulationType
) {
  let hasAnsweredAll = true;
  // TODO: SERVICE LEVEL FORM QUESTIONS IS NEEDED
  const questions = serviceLevelData.form_questions || [];
  const answers = simulation.form_answers ?? [];
  const excludedSectionLettersSet = new Set<string>();

  /** Calculate section scores */
  const sectionScoresRecord: SectionScoreRecord = {};
  for (const question of questions) {
    const section = question.section;
    const questionNo = question.question_no;

    const isSectionInRecord = section in sectionScoresRecord;
    if (!isSectionInRecord) {
      sectionScoresRecord[section] = {
        name: section,
        score: 0,
        total: 0,
        showScore: true,
        showAnswers: true
      };
    }

    const answer = answers.find(
      (answer) =>
        answer.section === section && answer.question_no === questionNo
    );

    const isNotesQuestion = question.question_no === 'Notes';
    const hasNoCorrectAnswer = question.correct_answer === '';
    const isAnswerNotRequired = answer?.answer === 'Not applicable';

    /** Copied from initial result calculation on simulation stop */
    const isExcludedFromInitialCalculation =
      isNotesQuestion || hasNoCorrectAnswer || isAnswerNotRequired;

    const isQuestionNotApplicable =
      answer?.question_no === 'Not applicable';
    const hasEmptyAnswer = answer?.answer === '';

    const [sectionLetter] = splitSectionName(answer?.section || '');
    const isSectionExcluded =
      excludedSectionLettersSet.has(sectionLetter);

    if (
      hasEmptyAnswer &&
      !isNotesQuestion &&
      !isQuestionNotApplicable &&
      !isSectionExcluded
    ) {
      hasAnsweredAll = false;
    }

    const isQuestionExcluded = isExcludedFromInitialCalculation;
    if (isQuestionExcluded) continue;

    const isAnswerCorrect = answer?.answer === question.correct_answer;
    if (isAnswerCorrect) {
      sectionScoresRecord[section].score += 1;
    }
    sectionScoresRecord[section].total += 1;
  }

  const sections: DisplaySectionScore[] = Object.values(
    sectionScoresRecord
  )
    /** Hide scores and answers if no scores */
    .map((displaySection) => {
      if (displaySection.total === 0) {
        return {
          ...displaySection,
          showScore: false,
          showAnswers: false
        };
      }

      return displaySection;
    })
    /** Exclude sections from settings */
    .map((displaySection) => {
      const [sectionLetter] = splitSectionName(displaySection.name);
      const isSectionExcluded =
        excludedSectionLettersSet.has(sectionLetter);
      if (isSectionExcluded) {
        return {
          ...displaySection,

          /** Exclude form overall scores */
          score: 0,
          total: 0,

          /** Hide scores but still show answer breakdown */
          showScore: false,
          showAnswers: true
        };
      }

      return displaySection;
    });

  const overall: DisplayScores['overall'] = {
    score: 0,
    total: 0,
    percentage: 0
  };

  /** Calculate overall scores */
  for (const displaySection of sections) {
    overall.score += displaySection.score;
    overall.total += displaySection.total;
  }

  const hasOverallScore = overall.total !== 0;
  if (hasOverallScore) {
    /** Display overall percentage as rounded down */
    overall.percentage = Math.floor(
      (overall.score / overall.total) * 100
    );
  }

  const scores: DisplayScores = { overall, sections };

  return { scores, hasAnsweredAll };
}
