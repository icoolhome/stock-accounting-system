import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import bcrypt from 'bcryptjs';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database.sqlite');

let db: sqlite3.Database;

export const getDatabase = (): sqlite3.Database => {
  if (!db) {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('資料庫連接失敗:', err);
      } else {
        console.log('已連接到 SQLite 資料庫');
      }
    });
  }
  return db;
};

// 導出統一的數據庫操作函數（在 initDatabase 之前定義，以便在遷移代碼中使用）
export const run = (sql: string, params: any[] = []): Promise<{ lastID: number; changes: number }> => {
  const database = getDatabase();
  return new Promise((resolve, reject) => {
    database.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve({ lastID: this.lastID || 0, changes: this.changes || 0 });
      }
    });
  });
};

export const get = <T = any>(sql: string, params: any[] = []): Promise<T | undefined> => {
  const database = getDatabase();
  return new Promise((resolve, reject) => {
    database.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row as T | undefined);
      }
    });
  });
};

export const all = <T = any>(sql: string, params: any[] = []): Promise<T[]> => {
  const database = getDatabase();
  return new Promise((resolve, reject) => {
    database.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve((rows || []) as T[]);
      }
    });
  });
};

export const initDatabase = async (): Promise<void> => {
  const database = getDatabase();
  
  // 本地 run 函數用於無參數的 SQL 語句
  const runNoParams = (sql: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      database.run(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  };

  // 用戶表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      username TEXT,
      role TEXT DEFAULT 'user',
      last_login_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 證券帳戶表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS securities_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      account_name TEXT NOT NULL,
      broker_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 交易記錄表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      securities_account_id INTEGER,
      trade_date TEXT NOT NULL,
      settlement_date TEXT,
      transaction_type TEXT NOT NULL,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      price REAL NOT NULL,
      fee REAL DEFAULT 0,
      transaction_amount REAL NOT NULL,
      tax REAL DEFAULT 0,
      securities_tax REAL DEFAULT 0,
      financing_amount REAL DEFAULT 0,
      margin REAL DEFAULT 0,
      interest REAL DEFAULT 0,
      borrowing_fee REAL DEFAULT 0,
      net_amount REAL NOT NULL,
      profit_loss REAL DEFAULT 0,
      return_rate REAL DEFAULT 0,
      holding_cost REAL DEFAULT 0,
      health_insurance REAL DEFAULT 0,
      currency TEXT DEFAULT 'TWD',
      buy_reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (securities_account_id) REFERENCES securities_accounts(id) ON DELETE SET NULL
    )
  `);

  // 銀行帳戶表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      securities_account_id INTEGER,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_type TEXT DEFAULT '儲蓄帳戶',
      balance REAL DEFAULT 0,
      currency TEXT DEFAULT 'TWD',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (securities_account_id) REFERENCES securities_accounts(id) ON DELETE SET NULL
    )
  `);

  // 庫存表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      securities_account_id INTEGER,
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      cost_price REAL NOT NULL,
      current_price REAL,
      market_value REAL,
      profit_loss REAL DEFAULT 0,
      profit_loss_percent REAL DEFAULT 0,
      currency TEXT DEFAULT 'TWD',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (securities_account_id) REFERENCES securities_accounts(id) ON DELETE SET NULL
    )
  `);

  // 交割管理表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      transaction_id INTEGER,
      bank_account_id INTEGER,
      settlement_date TEXT NOT NULL,
      trade_date TEXT,
      settlement_amount REAL NOT NULL,
      status TEXT DEFAULT '待處理',
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL,
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE SET NULL
    )
  `);

  // 歷史收益表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS dividends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      record_date TEXT NOT NULL,
      income_type TEXT DEFAULT '全部',
      stock_code TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      pre_tax_amount REAL NOT NULL,
      tax_amount REAL DEFAULT 0,
      after_tax_amount REAL NOT NULL,
      dividend_per_share REAL,
      share_count INTEGER,
      source TEXT,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 股票資料表（用於API更新）
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS stock_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      stock_code TEXT UNIQUE NOT NULL,
      stock_name TEXT NOT NULL,
      market_type TEXT,
      etf_type TEXT,
      industry TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 為現有數據庫添加 industry 字段（如果不存在）
  try {
    await runNoParams(`ALTER TABLE stock_data ADD COLUMN industry TEXT`);
  } catch (e: any) {
    // 字段已存在，忽略錯誤
    if (!e.message.includes('duplicate column')) {
      console.warn('添加 industry 字段時出現錯誤（可能字段已存在）:', e.message);
    }
  }

  // 為 dividends 表添加 securities_account_id 字段（如果不存在）
  try {
    await runNoParams(`ALTER TABLE dividends ADD COLUMN securities_account_id INTEGER`);
  } catch (e: any) {
    // 字段已存在，忽略錯誤
    if (!e.message.includes('duplicate column')) {
      console.warn('添加 securities_account_id 字段時出現錯誤（可能字段已存在）:', e.message);
    }
  }

  // 系統設定表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      setting_key TEXT NOT NULL,
      setting_value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, setting_key)
    )
  `);

  // 幣別設定表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS currency_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      currency_code TEXT NOT NULL,
      currency_name TEXT NOT NULL,
      exchange_rate REAL DEFAULT 1.0,
      is_default INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // 系統日誌表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_type TEXT NOT NULL,
      log_level TEXT DEFAULT 'info',
      message TEXT NOT NULL,
      details TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 證交所除權除息原始資料表（TWT49U）
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS twse_exrights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_date TEXT NOT NULL,
      stock_code TEXT NOT NULL,
      stock_name TEXT,
      pre_close_price REAL,
      ex_ref_price REAL,
      right_cash_value REAL,
      right_or_dividend TEXT,
      limit_up_price REAL,
      limit_down_price REAL,
      opening_ref_price REAL,
      dividend_deduction_ref REAL,
      detail TEXT,
      last_fin_period TEXT,
      last_nav_per_share REAL,
      last_eps REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(record_date, stock_code)
    )
  `);

  // 遷移現有 users 表：添加 role 和 last_login_at 字段
  try {
    await runNoParams(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`);
  } catch (e: any) {
    // 如果字段已存在則忽略錯誤
    if (!e.message.includes('duplicate column')) {
      console.log('添加 role 字段時發生錯誤（可能已存在）:', e.message);
    }
  }

  try {
    await runNoParams(`ALTER TABLE users ADD COLUMN last_login_at DATETIME`);
  } catch (e: any) {
    // 如果字段已存在則忽略錯誤
    if (!e.message.includes('duplicate column')) {
      console.log('添加 last_login_at 字段時發生錯誤（可能已存在）:', e.message);
    }
  }

  // 遷移現有 settlements 表：添加 twd_amount 字段
  try {
    await runNoParams(`ALTER TABLE settlements ADD COLUMN twd_amount REAL`);
  } catch (e: any) {
    // 如果字段已存在則忽略錯誤
    if (!e.message.includes('duplicate column')) {
      console.log('添加 twd_amount 字段時發生錯誤（可能已存在）:', e.message);
    }
  }

  // 遷移現有 settlements 表：添加 transaction_ids 字段（用於多選）
  try {
    await runNoParams(`ALTER TABLE settlements ADD COLUMN transaction_ids TEXT`);
  } catch (e: any) {
    // 如果字段已存在則忽略錯誤
    if (!e.message.includes('duplicate column')) {
      console.log('添加 transaction_ids 字段時發生錯誤（可能已存在）:', e.message);
    }
  }

  // 遷移現有 bank_accounts 表：添加 available_balance 字段
  try {
    await runNoParams(`ALTER TABLE bank_accounts ADD COLUMN available_balance REAL DEFAULT 0`);
  } catch (e: any) {
    // 如果字段已存在則忽略錯誤
    if (!e.message.includes('duplicate column')) {
      console.log('添加 available_balance 字段時發生錯誤（可能已存在）:', e.message);
    }
  }

  // 將現有的 transaction_id 遷移到 transaction_ids（只遷移一次）
  try {
    // 使用導出的 all 和 run 函數（在文件末尾定義，但可以在這裡使用）
    const settlements = await all<any>(`SELECT id, transaction_id, transaction_ids FROM settlements 
                                   WHERE transaction_id IS NOT NULL AND transaction_id != '' 
                                   AND (transaction_ids IS NULL OR transaction_ids = '')`);
    
    if (settlements && settlements.length > 0) {
      for (const settlement of settlements) {
        if (settlement.transaction_id) {
          const transactionIds = JSON.stringify([settlement.transaction_id]);
          await run('UPDATE settlements SET transaction_ids = ? WHERE id = ?', [transactionIds, settlement.id]);
        }
      }
      console.log(`已遷移 ${settlements.length} 筆交割記錄的 transaction_id 到 transaction_ids`);
    }
  } catch (e: any) {
    // 遷移失敗不影響正常運行
    console.log('遷移 transaction_id 到 transaction_ids 時發生錯誤（可忽略）:', e.message);
  }

  // 銀行明細表
  await runNoParams(`
    CREATE TABLE IF NOT EXISTS bank_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      bank_account_id INTEGER NOT NULL,
      transaction_date TEXT NOT NULL,
      description TEXT,
      transaction_category TEXT,
      deposit_amount REAL DEFAULT 0,
      withdrawal_amount REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id) ON DELETE CASCADE
    )
  `);

  // 為現有數據庫添加 transaction_category 字段（如果不存在）
  try {
    await runNoParams(`ALTER TABLE bank_transactions ADD COLUMN transaction_category TEXT`);
  } catch (e: any) {
    // 字段已存在，忽略錯誤
    if (!e.message.includes('duplicate column')) {
      console.warn('添加 transaction_category 字段時出現錯誤（可能字段已存在）:', e.message);
    }
  }

  // 初始化默認管理員帳號（如果不存在）
  try {
    const defaultAdminEmail = 'admin@admin.com';
    const defaultAdminPassword = 'adminadmin';
    
    const existingAdmin = await get<any>('SELECT * FROM users WHERE email = ?', [defaultAdminEmail]);
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(defaultAdminPassword, 10);
      await run(
        'INSERT INTO users (email, password, username, role) VALUES (?, ?, ?, ?)',
        [defaultAdminEmail, hashedPassword, '管理員', 'admin']
      );
      console.log('已創建默認管理員帳號：admin@admin.com / adminadmin');
    } else {
      // 如果管理員已存在但不是 admin 角色，更新為 admin
      if (existingAdmin.role !== 'admin') {
        await run('UPDATE users SET role = ? WHERE email = ?', ['admin', defaultAdminEmail]);
        console.log('已更新管理員角色：admin@admin.com');
      }
    }
  } catch (error: any) {
    console.warn('初始化默認管理員帳號時發生錯誤（可忽略）:', error.message);
  }

  console.log('資料庫表已初始化');
};

