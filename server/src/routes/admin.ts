import express from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase } from '../database';
import { authenticate, isAdmin, AuthRequest } from '../middleware/auth';
import { promisify } from 'util';

const router = express.Router();

// 所有管理員路由都需要認證和管理員權限
router.use(authenticate);
router.use(isAdmin);

const get = (sql: string, params: any[]): Promise<any> => {
  const db = getDatabase();
  return promisify(db.get.bind(db))(sql, params);
};

const all = (sql: string, params: any[]): Promise<any[]> => {
  const db = getDatabase();
  return promisify(db.all.bind(db))(sql, params);
};

const run = (sql: string, params: any[]): Promise<{ lastID: number; changes: number }> => {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID, changes: this.changes });
      }
    });
  });
};

// 用戶統計
router.get('/users/stats', async (req, res) => {
  try {
    const db = getDatabase();

    // 總用戶數
    const totalUsers = await get('SELECT COUNT(*) as count FROM users', []);
    
    // 活躍用戶數（至少登入過一次）
    const activeUsers = await get('SELECT COUNT(*) as count FROM users WHERE last_login_at IS NOT NULL', []);
    
    // 今日新增用戶數
    const today = new Date().toISOString().split('T')[0];
    const todayNewUsers = await get('SELECT COUNT(*) as count FROM users WHERE DATE(created_at) = ?', [today]);

    res.json({
      success: true,
      data: {
        totalUsers: totalUsers.count,
        activeUsers: activeUsers.count,
        todayNewUsers: todayNewUsers.count,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取用戶統計失敗',
    });
  }
});

// 獲取用戶列表（支持分頁和搜尋）
router.get('/users', async (req, res) => {
  try {
    const { page = 1, pageSize = 10, search = '' } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let sql = 'SELECT id, email, username, role, last_login_at, created_at FROM users';
    let countSql = 'SELECT COUNT(*) as count FROM users';
    const params: any[] = [];
    const countParams: any[] = [];

    if (search) {
      sql += ' WHERE email LIKE ? OR username LIKE ?';
      countSql += ' WHERE email LIKE ? OR username LIKE ?';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
      countParams.push(searchPattern, searchPattern);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(Number(pageSize), offset);

    const users = await all(sql, params);
    const totalResult = await get(countSql, countParams);
    const total = totalResult.count;

    res.json({
      success: true,
      data: {
        users: users.map((u: any) => ({
          ...u,
          last_login_at: u.last_login_at || null,
        })),
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取用戶列表失敗',
    });
  }
});

// 刪除用戶
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as AuthRequest).userId;

    // 不能刪除自己
    if (Number(id) === userId) {
      return res.status(400).json({
        success: false,
        message: '不能刪除自己的帳戶',
      });
    }

    await run('DELETE FROM users WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '用戶已刪除',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除用戶失敗',
    });
  }
});

// 獲取當前管理員資訊
router.get('/admin/current', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId;
    const user = await get('SELECT id, email, role FROM users WHERE id = ?', [userId]);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '不是管理員',
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取管理員資訊失敗',
    });
  }
});

// 獲取所有管理員列表
router.get('/admin/list', async (req, res) => {
  try {
    const admins = await all('SELECT id, email, role, created_at FROM users WHERE role = ?', ['admin']);

    // 注意：不返回密碼，但根據需求要顯示密碼（這裡只返回 email，前端可以要求輸入密碼）
    res.json({
      success: true,
      data: admins.map((admin: any) => ({
        id: admin.id,
        email: admin.email,
        role: admin.role,
        created_at: admin.created_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取管理員列表失敗',
    });
  }
});

// 新增管理員
router.post('/admin/create', async (req, res) => {
  try {
    const { email, password } = req.body;

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

    // 創建管理員
    await run('INSERT INTO users (email, password, username, role) VALUES (?, ?, ?, ?)', [
      email,
      hashedPassword,
      email,
      'admin',
    ]);

    res.json({
      success: true,
      message: '管理員已創建',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '創建管理員失敗',
    });
  }
});

// 編輯管理員（只更新郵箱和密碼，不顯示現有密碼）
router.put('/admin/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password } = req.body;

    const admin = await get('SELECT * FROM users WHERE id = ? AND role = ?', [id, 'admin']);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: '管理員不存在',
      });
    }

    const updates: string[] = [];
    const params: any[] = [];

    // 如果提供了 email 且不為空字符串，則更新
    if (email !== undefined && email !== null && email !== '') {
      // 檢查新郵箱是否已被使用
      const existingUser = await get('SELECT * FROM users WHERE email = ? AND id != ?', [email, id]);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '該郵箱已被使用',
        });
      }
      updates.push('email = ?');
      params.push(email);
    }

    // 如果提供了 password 且不為空字符串，則更新
    if (password !== undefined && password !== null && password !== '') {
      if (password.length < 8 || password.length > 12) {
        return res.status(400).json({
          success: false,
          message: '密碼長度必須在 8-12 位之間',
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '沒有要更新的內容',
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({
      success: true,
      message: '管理員已更新',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新管理員失敗',
    });
  }
});

// 更新當前管理員設定
router.put('/admin/current', async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { email, password } = req.body;

    const updates: string[] = [];
    const params: any[] = [];

    // 如果提供了 email 且不為空字符串，則更新
    if (email !== undefined && email !== null && email !== '') {
      // 檢查新郵箱是否已被使用
      const existingUser = await get('SELECT * FROM users WHERE email = ? AND id != ?', [email, userId]);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: '該郵箱已被使用',
        });
      }
      updates.push('email = ?');
      params.push(email);
    }

    // 如果提供了 password 且不為空字符串，則更新
    if (password !== undefined && password !== null && password !== '') {
      if (password.length < 8 || password.length > 12) {
        return res.status(400).json({
          success: false,
          message: '密碼長度必須在 8-12 位之間',
        });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      updates.push('password = ?');
      params.push(hashedPassword);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: '沒有要更新的內容',
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(userId);

    await run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({
      success: true,
      message: '設定已更新',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新設定失敗',
    });
  }
});

// 系統診斷
router.post('/diagnostics', async (req, res) => {
  try {
    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      checks: [],
    };

    const db = getDatabase();

    // 檢查資料庫連接
    try {
      await get('SELECT 1', []);
      diagnostics.checks.push({ name: '資料庫連接', status: 'success', message: '正常' });
    } catch (error: any) {
      diagnostics.checks.push({ name: '資料庫連接', status: 'error', message: error.message });
    }

    // 檢查用戶表
    try {
      const userCount = await get('SELECT COUNT(*) as count FROM users', []);
      diagnostics.checks.push({ name: '用戶表', status: 'success', message: `用戶數: ${userCount.count}` });
    } catch (error: any) {
      diagnostics.checks.push({ name: '用戶表', status: 'error', message: error.message });
    }

    // 檢查交易記錄表
    try {
      const transCount = await get('SELECT COUNT(*) as count FROM transactions', []);
      diagnostics.checks.push({ name: '交易記錄表', status: 'success', message: `記錄數: ${transCount.count}` });
    } catch (error: any) {
      diagnostics.checks.push({ name: '交易記錄表', status: 'error', message: error.message });
    }

    // 創建診斷日誌
    const logMessage = JSON.stringify(diagnostics);
    await run(
      'INSERT INTO system_logs (log_type, log_level, message, details) VALUES (?, ?, ?, ?)',
      ['diagnostics', 'info', '系統診斷完成', logMessage]
    );

    res.json({
      success: true,
      data: diagnostics,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '系統診斷失敗',
    });
  }
});

// 刪除全部業務數據（不刪除用戶與管理員帳號）
router.post('/purge', async (req: AuthRequest, res) => {
  try {
    const db = getDatabase();
    const rawRun = promisify(db.run.bind(db));

    await rawRun('BEGIN TRANSACTION', []);

    // 先刪除子表，再刪除父表，避免外鍵約束問題
    await rawRun('DELETE FROM bank_transactions', []);
    await rawRun('DELETE FROM settlements', []);
    await rawRun('DELETE FROM holdings', []);
    await rawRun('DELETE FROM dividends', []);
    await rawRun('DELETE FROM transactions', []);
    await rawRun('DELETE FROM bank_accounts', []);
    await rawRun('DELETE FROM securities_accounts', []);
    await rawRun('DELETE FROM stock_data', []);
    await rawRun('DELETE FROM currency_settings', []);
    await rawRun('DELETE FROM system_logs', []);
    await rawRun('DELETE FROM twse_exrights', []);

    await rawRun('COMMIT', []);

    res.json({
      success: true,
      message: '已刪除全部業務數據（不含用戶與管理員帳號）',
    });
  } catch (error: any) {
    try {
      const db = getDatabase();
      const rawRun = promisify(db.run.bind(db));
      await rawRun('ROLLBACK', []);
    } catch {
      // ignore rollback error
    }
    res.status(500).json({
      success: false,
      message: error.message || '刪除全部數據失敗',
    });
  }
});

// 獲取系統日誌列表（支持分頁）
router.get('/logs', async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const logs = await all(
      'SELECT * FROM system_logs ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [Number(pageSize), offset]
    );

    const totalResult = await get('SELECT COUNT(*) as count FROM system_logs', []);
    const total = totalResult.count;

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: Number(page),
          pageSize: Number(pageSize),
          total,
          totalPages: Math.ceil(total / Number(pageSize)),
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取日誌列表失敗',
    });
  }
});

// 刪除日誌
router.delete('/logs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM system_logs WHERE id = ?', [id]);

    res.json({
      success: true,
      message: '日誌已刪除',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除日誌失敗',
    });
  }
});

export default router;

