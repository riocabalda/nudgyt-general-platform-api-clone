import { RequestHandler } from 'express';
import { ParamsDictionary, Query } from 'express-serve-static-core';

type Function = (...params: any[]) => any;

/** https://stackoverflow.com/a/50014868 */
type ReplaceReturnType<T extends Function, TNewReturn> = (
  ...params: Parameters<T>
) => TNewReturn;

/**
 * - To be async, make return type of `RequestHandler` a promise
 * - To be compatible with other libraries that expect a generic `RequestHandler`, make this generic as well
 */
type AsyncRequestHandler<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = Query,
  Locals extends Record<string, any> = Record<string, any>
> = ReplaceReturnType<
  RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>,
  Promise<void>
>;

/**
 * - To be compatible with other libraries that expect a generic `RequestHandler`, make this generic as well
 */
const asyncWrapper =
  <
    P = ParamsDictionary,
    ResBody = any,
    ReqBody = any,
    ReqQuery = Query,
    Locals extends Record<string, any> = Record<string, any>
  >(
    fn: AsyncRequestHandler<P, ResBody, ReqBody, ReqQuery, Locals>
  ): RequestHandler<P, ResBody, ReqBody, ReqQuery, Locals> =>
  async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };

export default asyncWrapper;
