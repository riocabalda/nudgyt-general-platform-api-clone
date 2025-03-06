import { Dictionary, groupBy, isEmpty } from 'lodash';
import naturalSort from './natural-sort';

type DataObject = {
  [key: string]: string;
};

type QuestionOption = {
  option: string;
  option_description: string;
  pre_fill: string;
};

type Question = {
  section: string;
  question_no: string;
  question_type: string;
  pre_fill: string;
  correct_answer: string;
  options: QuestionOption[];
  question_title: string;
  question_description: string;
};

function mergeQuestionDuplicates(
  questionDuplicates: DataObject[],
  section: string,
  questionNo: string,
  questionFilterType = ['MCQ', 'MCQO', 'MCQIF']
) {
  const mergedQuestion: Question = {
    section,
    question_no: questionNo,
    question_type: '',
    pre_fill: '',
    correct_answer: '',
    options: [],
    question_title: '',
    question_description: ''
  };

  for (const question of questionDuplicates) {
    /** Assign options */
    mergedQuestion.options.push({
      option: question.option,
      option_description: question.option_description,
      pre_fill: question.pre_fill
    });

    /** Assign correct answer */
    if (questionFilterType.includes(question.question_type)) {
      if (question.correct_answer === '1') {
        mergedQuestion.correct_answer = question.option;
      }
    } else {
      mergedQuestion.correct_answer = question.correct_answer;
    }

    /** Assign other fields */
    if (!isEmpty(question.question_type)) {
      mergedQuestion.question_type = question.question_type;
    }
    if (!isEmpty(question.pre_fill)) {
      mergedQuestion.pre_fill = question.pre_fill;
    }
    if (!isEmpty(question.question_title)) {
      mergedQuestion.question_title = question.question_title;
    }
    if (!isEmpty(question.question_description)) {
      mergedQuestion.question_description =
        question.question_description;
    }
  }

  return mergedQuestion;
}

function* generateFormattedQuestions(
  questionsBySection: Dictionary<DataObject[]>
) {
  for (const [section, sectionQuestions] of Object.entries(
    questionsBySection
  )) {
    const sectionQuestionsByNo = groupBy(
      sectionQuestions,
      'question_no'
    );

    const sortedEntries = Object.entries(sectionQuestionsByNo).sort(
      ([a], [b]) => naturalSort(a, b)
    );

    for (const [questionNo, questionDuplicates] of sortedEntries) {
      yield mergeQuestionDuplicates(
        questionDuplicates,
        section,
        questionNo
      );
    }
  }
}

function formatQuestions(questionsBySection: Dictionary<DataObject[]>) {
  return [...generateFormattedQuestions(questionsBySection)];
}

export default formatQuestions;
