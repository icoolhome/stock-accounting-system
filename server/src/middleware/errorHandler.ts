import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('錯誤:', err);

  res.status(500).json({
    success: false,
    message: err.message || '伺服器內部錯誤',
  });
};


