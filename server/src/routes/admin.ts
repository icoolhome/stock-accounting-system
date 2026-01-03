import express from 'express';
import bcrypt from 'bcryptjs';
import { getDatabase, run, get, all } from '../database';
import { authenticate, isAdmin, AuthRequest } from '../middleware/auth';

const router = express.Router();

// 所有管理員路由都需要認證和管理員權限
router.use(authenticate);
router.use(isAdmin);

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

    // ========== 基礎檢查 ==========
    
    // 檢查資料庫連接
    try {
      await get('SELECT 1', []);
      diagnostics.checks.push({ category: '基礎檢查', name: '資料庫連接', status: 'success', message: '正常' });
    } catch (error: any) {
      diagnostics.checks.push({ category: '基礎檢查', name: '資料庫連接', status: 'error', message: error.message });
    }

    // 檢查資料庫文件大小
    try {
      const fs = require('fs');
      const path = require('path');
      const dbPath = process.env.DB_PATH || path.join(__dirname, '../../database.sqlite');
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
        diagnostics.checks.push({ category: '基礎檢查', name: '資料庫文件大小', status: 'success', message: `${sizeInMB} MB` });
      } else {
        diagnostics.checks.push({ category: '基礎檢查', name: '資料庫文件大小', status: 'warning', message: '資料庫文件不存在' });
      }
    } catch (error: any) {
      diagnostics.checks.push({ category: '基礎檢查', name: '資料庫文件大小', status: 'error', message: error.message });
    }

    // ========== 數據表檢查 ==========
    
    // 定義所有需要檢查的數據表
    const tables = [
      { name: 'users', displayName: '用戶表' },
      { name: 'securities_accounts', displayName: '證券帳戶表' },
      { name: 'transactions', displayName: '交易記錄表' },
      { name: 'bank_accounts', displayName: '銀行帳戶表' },
      { name: 'bank_transactions', displayName: '銀行明細表' },
      { name: 'holdings', displayName: '庫存表' },
      { name: 'settlements', displayName: '交割記錄表' },
      { name: 'dividends', displayName: '收益記錄表' },
      { name: 'stock_data', displayName: '股票資料表' },
      { name: 'currency_settings', displayName: '幣別設定表' },
      { name: 'system_logs', displayName: '系統日誌表' },
      { name: 'twse_exrights', displayName: '除權除息資料表' },
    ];

    // 檢查每個數據表
    for (const table of tables) {
      try {
        const count = await get(`SELECT COUNT(*) as count FROM ${table.name}`, []);
        diagnostics.checks.push({ 
          category: '數據表檢查', 
          name: table.displayName, 
          status: 'success', 
          message: `記錄數: ${count?.count || 0}` 
        });
      } catch (error: any) {
        diagnostics.checks.push({ 
          category: '數據表檢查', 
          name: table.displayName, 
          status: 'error', 
          message: error.message 
        });
      }
    }

    // ========== 數據完整性檢查 ==========
    
    // 檢查資料庫完整性（SQLite 內建完整性檢查）
    try {
      const integrityCheck = await all('PRAGMA integrity_check', []);
      if (integrityCheck && integrityCheck.length > 0 && integrityCheck[0].integrity_check === 'ok') {
        diagnostics.checks.push({ category: '數據完整性', name: '資料庫完整性', status: 'success', message: '正常' });
      } else {
        diagnostics.checks.push({ category: '數據完整性', name: '資料庫完整性', status: 'warning', message: '完整性檢查返回異常' });
      }
    } catch (error: any) {
      diagnostics.checks.push({ category: '數據完整性', name: '資料庫完整性', status: 'warning', message: '無法執行完整性檢查' });
    }

    // 檢查孤立記錄（沒有對應用戶的記錄）
    const orphanChecks = [
      { table: 'transactions', foreignKey: 'user_id', displayName: '交易記錄' },
      { table: 'securities_accounts', foreignKey: 'user_id', displayName: '證券帳戶' },
      { table: 'bank_accounts', foreignKey: 'user_id', displayName: '銀行帳戶' },
      { table: 'holdings', foreignKey: 'user_id', displayName: '庫存' },
      { table: 'settlements', foreignKey: 'user_id', displayName: '交割記錄' },
      { table: 'dividends', foreignKey: 'user_id', displayName: '收益記錄' },
    ];

    for (const check of orphanChecks) {
      try {
        const orphanCount = await get(
          `SELECT COUNT(*) as count FROM ${check.table} WHERE ${check.foreignKey} NOT IN (SELECT id FROM users)`,
          []
        );
        if (orphanCount && orphanCount.count > 0) {
          diagnostics.checks.push({ 
            category: '數據完整性', 
            name: `${check.displayName}孤立記錄`, 
            status: 'warning', 
            message: `發現 ${orphanCount.count} 條孤立記錄` 
          });
        } else {
          diagnostics.checks.push({ 
            category: '數據完整性', 
            name: `${check.displayName}孤立記錄`, 
            status: 'success', 
            message: '無孤立記錄' 
          });
        }
      } catch (error: any) {
        diagnostics.checks.push({ 
          category: '數據完整性', 
          name: `${check.displayName}孤立記錄`, 
          status: 'error', 
          message: error.message 
        });
      }
    }

    // ========== 系統狀態檢查 ==========
    
    // 檢查最近的錯誤日誌
    try {
      const errorLogs = await all(
        "SELECT COUNT(*) as count FROM system_logs WHERE log_level = 'error' AND created_at > datetime('now', '-7 days')",
        []
      );
      const errorCount = errorLogs[0]?.count || 0;
      if (errorCount > 0) {
        diagnostics.checks.push({ 
          category: '系統狀態', 
          name: '最近7天錯誤日誌', 
          status: 'warning', 
          message: `發現 ${errorCount} 條錯誤日誌` 
        });
      } else {
        diagnostics.checks.push({ 
          category: '系統狀態', 
          name: '最近7天錯誤日誌', 
          status: 'success', 
          message: '無錯誤日誌' 
        });
      }
    } catch (error: any) {
      diagnostics.checks.push({ category: '系統狀態', name: '最近7天錯誤日誌', status: 'error', message: error.message });
    }

    // 檢查系統日誌總數
    try {
      const logCount = await get('SELECT COUNT(*) as count FROM system_logs', []);
      diagnostics.checks.push({ 
        category: '系統狀態', 
        name: '系統日誌總數', 
        status: 'success', 
        message: `共 ${logCount?.count || 0} 條日誌` 
      });
    } catch (error: any) {
      diagnostics.checks.push({ category: '系統狀態', name: '系統日誌總數', status: 'error', message: error.message });
    }

    // 檢查管理員帳號數量
    try {
      const adminCount = await get("SELECT COUNT(*) as count FROM users WHERE role = 'admin'", []);
      const count = adminCount?.count || 0;
      if (count === 0) {
        diagnostics.checks.push({ 
          category: '系統狀態', 
          name: '管理員帳號', 
          status: 'warning', 
          message: '未發現管理員帳號' 
        });
      } else {
        diagnostics.checks.push({ 
          category: '系統狀態', 
          name: '管理員帳號', 
          status: 'success', 
          message: `共 ${count} 個管理員帳號` 
        });
      }
    } catch (error: any) {
      diagnostics.checks.push({ category: '系統狀態', name: '管理員帳號', status: 'error', message: error.message });
    }

    // ========== 數據統計 ==========
    
    // 統計各表數據量（只統計主要業務表）
    const statsTables = [
      { name: 'transactions', displayName: '交易記錄' },
      { name: 'holdings', displayName: '庫存記錄' },
      { name: 'dividends', displayName: '收益記錄' },
      { name: 'settlements', displayName: '交割記錄' },
      { name: 'bank_transactions', displayName: '銀行明細' },
    ];

    for (const table of statsTables) {
      try {
        const count = await get(`SELECT COUNT(*) as count FROM ${table.name}`, []);
        diagnostics.checks.push({ 
          category: '數據統計', 
          name: table.displayName, 
          status: 'success', 
          message: `${count?.count || 0} 筆` 
        });
      } catch (error: any) {
        diagnostics.checks.push({ 
          category: '數據統計', 
          name: table.displayName, 
          status: 'error', 
          message: error.message 
        });
      }
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
    await run('BEGIN TRANSACTION', []);

    // 先刪除子表，再刪除父表，避免外鍵約束問題
    await run('DELETE FROM bank_transactions', []);
    await run('DELETE FROM settlements', []);
    await run('DELETE FROM holdings', []);
    await run('DELETE FROM dividends', []);
    await run('DELETE FROM transactions', []);
    await run('DELETE FROM bank_accounts', []);
    await run('DELETE FROM securities_accounts', []);
    await run('DELETE FROM stock_data', []);
    await run('DELETE FROM currency_settings', []);
    await run('DELETE FROM system_logs', []);
    await run('DELETE FROM twse_exrights', []);

    await run('COMMIT', []);

    res.json({
      success: true,
      message: '已刪除全部業務數據（不含用戶與管理員帳號）',
    });
  } catch (error: any) {
    try {
      await run('ROLLBACK', []);
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

    const totalResult = await get<{ count: number }>('SELECT COUNT(*) as count FROM system_logs', []);
    const total = totalResult?.count || 0;

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

// 獲取所有系統日誌（不分頁，用於匯出）
router.get('/logs/all', async (req, res) => {
  try {
    const logs = await all('SELECT * FROM system_logs ORDER BY created_at DESC');

    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取所有日誌失敗',
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

