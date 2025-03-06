import mongoose, { Document } from 'mongoose';

export type FormQuestionOptionType = {
  option: string;
  option_description: string;
  pre_fill: string;
};

export type FormQuestionType = Document & {
  section: string;
  question_no: string;
  question_type: string;
  question_title: string;
  question_description: string;
  correct_answer: string;
  sub_title: string;
  sub_title_description: string;
  key_question: string;
  pre_fill: string;
  dependency: string;
  table_row_title: string;
  add_next_row_if_last_row: string;
  options: FormQuestionOptionType[];
};

const FormOptions = new mongoose.Schema<FormQuestionOptionType>({
  option: {
    type: String
  },
  option_description: {
    type: String
  },
  pre_fill: {
    type: String
  }
});

const FormQuestionSchema = new mongoose.Schema<FormQuestionType>(
  {
    section: {
      type: String
    },
    question_no: {
      type: String
    },
    question_type: {
      type: String
    },
    question_title: {
      type: String
    },
    question_description: {
      type: String
    },
    correct_answer: {
      type: String
    },
    sub_title: {
      type: String
    },
    sub_title_description: {
      type: String
    },
    key_question: {
      type: String
    },
    pre_fill: {
      type: String
    },
    dependency: {
      type: String
    },
    table_row_title: {
      type: String
    },
    add_next_row_if_last_row: {
      type: String
    },
    options: [FormOptions]
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

const FormQuestion = mongoose.model<FormQuestionType>(
  'form_question',
  FormQuestionSchema
);

export default FormQuestion;
