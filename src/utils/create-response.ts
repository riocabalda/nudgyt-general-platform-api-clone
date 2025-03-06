import { ReasonPhrases } from 'http-status-codes';

type Response<T> = {
  message: string;
  data?: T;
  [key: string]: any;
};

type CreateResponseParams<T> = {
  message?: string;
  data?: T;
  customFields?: Record<string, any>;
};

const createResponse = <T>({
  message = ReasonPhrases.OK,
  data,
  customFields
}: CreateResponseParams<T>): Response<T> => ({
  message,
  ...(data !== undefined && { data }),
  ...customFields
});

export default createResponse;
