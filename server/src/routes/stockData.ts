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

// 獲取股票詳細資訊（包含價格、配息記錄等）
router.get('/:code/detail', async (req: AuthRequest, res) => {
  try {
    const { code } = req.params;
    const db = getDatabase();
    const get = promisify(db.get.bind(db));
    const all = promisify(db.all.bind(db));

    // 獲取股票基本資料
    const stockInfo: any = await get(
      'SELECT stock_code, stock_name, market_type, etf_type, industry FROM stock_data WHERE stock_code = ?',
      [code]
    );

    if (!stockInfo) {
      return res.status(404).json({
        success: false,
        message: '找不到該股票資料',
      });
    }

    // 獲取股票價格（使用TWSE API）
    let priceInfo: any = null;
    try {
      const priceResponse = await fetch('https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL', {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (priceResponse.ok) {
        const priceData: any[] = await priceResponse.json();
        const stock = priceData.find((item: any) => {
          const stockCode = item.Code || item.code || item.股票代號;
          return stockCode === code || stockCode === code.padStart(6, '0');
        });

        if (stock) {
          priceInfo = {
            open: stock.Open || stock.open || stock.開盤價,
            high: stock.High || stock.high || stock.最高價,
            low: stock.Low || stock.low || stock.最低價,
            close: stock.Close || stock.close || stock.收盤價,
            change: stock.Change || stock.change || stock.漲跌,
            volume: stock.Volume || stock.volume || stock.成交量,
            yesterdayClose: stock.YesterdayClose || stock.yesterdayClose || stock.昨收,
          };
        }
      }
    } catch (priceError) {
      console.error('獲取股票價格失敗:', priceError);
    }

    // 獲取該股票的配息記錄（從用戶的歷史收益中查詢）
    const dividends = await all(
      `
      SELECT record_date, income_type, pre_tax_amount, tax_amount, after_tax_amount, 
             dividend_per_share, share_count
      FROM dividends
      WHERE user_id = ? AND stock_code = ?
      ORDER BY record_date DESC
      LIMIT 50
      `,
      [req.userId, code]
    );

    // 計算配息統計
    const currentYear = new Date().getFullYear();
    const thisYearDividends = dividends.filter((d: any) => {
      const year = new Date(d.record_date).getFullYear();
      return year === currentYear;
    });

    const lastYearDividends = dividends.filter((d: any) => {
      const year = new Date(d.record_date).getFullYear();
      return year === currentYear - 1;
    });

    const totalThisYear = thisYearDividends.reduce((sum: number, d: any) => sum + (d.after_tax_amount || 0), 0);
    const totalLastYear = lastYearDividends.reduce((sum: number, d: any) => sum + (d.after_tax_amount || 0), 0);

    // 計算近五年平均
    const fiveYearsAgo = currentYear - 4;
    const recentFiveYearsDividends = dividends.filter((d: any) => {
      const year = new Date(d.record_date).getFullYear();
      return year >= fiveYearsAgo && year <= currentYear;
    });
    const avgFiveYears = recentFiveYearsDividends.length > 0
      ? recentFiveYearsDividends.reduce((sum: number, d: any) => sum + (d.after_tax_amount || 0), 0) / 5
      : 0;

    res.json({
      success: true,
      data: {
        stockInfo,
        priceInfo,
        dividends: dividends.slice(0, 20), // 只返回最近20筆
        dividendStats: {
          thisYear: totalThisYear,
          lastYear: totalLastYear,
          avgFiveYears,
          thisYearCount: thisYearDividends.length,
          lastYearCount: lastYearDividends.length,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取股票詳細資訊失敗',
    });
  }
});

export default router;




