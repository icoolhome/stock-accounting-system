import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../database';
import { promisify } from 'util';

const router = express.Router();

// 註冊
router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '請提供郵箱和密碼',
      });
    }

    if (password.length < 8 || password.length > 12) {
      return res.status(400).json({
        success: false,
        message: '密碼長度必須在 8-12 位之間',
      });
    }

    const db = getDatabase();
    const get = promisify(db.get.bind(db));

    const insertUser = (sql: string, params: any[]) =>
      new Promise<number>((resolve, reject) => {
        db.run(sql, params, function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        });
      });

    // 檢查用戶是否已存在
    const existingUser = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '該郵箱已被註冊',
      });
    }

    // 加密密碼
    const hashedPassword = await bcrypt.hash(password, 10);

    // 創建用戶
    const newUserId = await insertUser(
      'INSERT INTO users (email, password, username) VALUES (?, ?, ?)',
      [email, hashedPassword, username || email]
    );

    const token = jwt.sign(
      { userId: newUserId },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: '註冊成功',
      token,
      user: {
        id: newUserId,
        email,
        username: username || email,
        role: 'user',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '註冊失敗',
    });
  }
});

// 登入
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: '請提供郵箱和密碼',
      });
    }

    const db = getDatabase();
    const get = promisify(db.get.bind(db));

    // 查找用戶
    const user: any = await get('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '郵箱或密碼錯誤',
      });
    }

    // 驗證密碼
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: '郵箱或密碼錯誤',
      });
    }

    // 更新最後登入時間
    const updateLoginTime = (sql: string, params: any[]) =>
      new Promise<void>((resolve, reject) => {
        db.run(sql, params, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    await updateLoginTime('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET || 'default-secret',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: '登入成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role || 'user',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '登入失敗',
    });
  }
});

export default router;


