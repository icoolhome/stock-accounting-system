import express from 'express';
import { getDatabase } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { promisify } from 'util';

const router = express.Router();

// 所有股票資料相關路由都需要認證
router.use(authenticate);

// 獲取所有股票資料
router.get('/', async (req: AuthRequest, res) => {
  try {
    const db = getDatabase();
    const all = promisify(db.all.bind(db));

    const rows = await all(
      `
      SELECT stock_code, stock_name, market_type, etf_type, industry
      FROM stock_data
      ORDER BY stock_code
      `
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取股票資料失敗',
    });
  }
});

// 更新或插入股票資料
router.put('/', async (req: AuthRequest, res) => {
  try {
    const { stock_code, stock_name, market_type, etf_type, industry } = req.body;

    if (!stock_code || !stock_name) {
      return res.status(400).json({
        success: false,
        message: '股票代碼和股票名稱為必填項',
      });
    }

    const db = getDatabase();
    const run = promisify(db.run.bind(db));

    await run(
      `
      INSERT INTO stock_data (stock_code, stock_name, market_type, etf_type, industry)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(stock_code) DO UPDATE SET
        stock_name = excluded.stock_name,
        market_type = excluded.market_type,
        etf_type = excluded.etf_type,
        industry = excluded.industry,
        updated_at = CURRENT_TIMESTAMP
      `,
      [stock_code, stock_name, market_type || null, etf_type || null, industry || null]
    );

    res.json({
      success: true,
      message: '股票資料更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新股票資料失敗',
    });
  }
});

// 依關鍵字搜尋股票代碼 / 名稱（供交易輸入自動帶出）
router.get('/search', async (req: AuthRequest, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || typeof keyword !== 'string' || keyword.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: '請提供搜尋關鍵字',
      });
    }

    const db = getDatabase();
    const all = promisify(db.all.bind(db));

    const like = `%${keyword.trim()}%`;
    const rows = await all(
      `
      SELECT stock_code, stock_name, market_type, etf_type
      FROM stock_data
      WHERE stock_code LIKE ? OR stock_name LIKE ?
      ORDER BY stock_code
      LIMIT 20
      `,
      [like, like]
    );

    res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '搜尋股票資料失敗',
    });
  }
});

export default router;




