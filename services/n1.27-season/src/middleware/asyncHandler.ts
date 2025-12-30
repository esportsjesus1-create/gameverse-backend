import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler<P = object, ResBody = unknown, ReqBody = unknown, ReqQuery = object> = (
  req: Request<P, ResBody, ReqBody, ReqQuery>,
  res: Response<ResBody>,
  next: NextFunction
) => Promise<void>;

export const asyncHandler = <P = object, ResBody = unknown, ReqBody = unknown, ReqQuery = object>(
  fn: AsyncRequestHandler<P, ResBody, ReqBody, ReqQuery>
): RequestHandler<P, ResBody, ReqBody, ReqQuery> => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
