import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { get } from '../database';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '未提供認證令牌',
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'default-secret'
    ) as { userId: number };

    req.userId = decoded.userId;

    // 獲取用戶角色
    const user: any = await get<{ role: string }>('SELECT role FROM users WHERE id = ?', [decoded.userId]);
    if (user) {
      req.userRole = user.role || 'user';
    }

    next();
  } catch (error: any) {
    // 區分不同的錯誤類型
    let message = '無效的認證令牌';
    if (error.name === 'TokenExpiredError') {
      message = '認證令牌已過期，請重新登錄';
    } else if (error.name === 'JsonWebTokenError') {
      message = '認證令牌格式錯誤';
    }
    
    return res.status(401).json({
      success: false,
      message,
      error: error.name,
    });
  }
};

// 管理員權限檢查中間件
export const isAdmin = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '需要管理員權限',
    });
  }
  next();
};


