import express from 'express';
import { all, get, run } from '../database';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

// 獲取所有歷史收益記錄
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, incomeType, stockCode } = req.query;
    let query = 'SELECT * FROM dividends WHERE user_id = ?';
    const params: any[] = [req.userId];

    if (startDate) {
      query += ' AND record_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND record_date <= ?';
      params.push(endDate);
    }
    if (incomeType && incomeType !== '全部') {
      query += ' AND income_type = ?';
      params.push(incomeType);
    }
    if (stockCode) {
      query += ' AND stock_code LIKE ?';
      params.push(`%${stockCode}%`);
    }

    query += ' ORDER BY record_date DESC, created_at DESC';

    const dividends = await all<any>(query, params);

    // 計算統計
    const totalAfterTax = dividends.reduce((sum: number, d: any) => sum + (d.after_tax_amount || 0), 0);
    const totalProfitLoss = 0; // 需要從交易記錄計算
    const totalDividend = dividends
      .filter((d: any) => d.income_type === '股息' || d.income_type === 'ETF股息')
      .reduce((sum: number, d: any) => sum + (d.after_tax_amount || 0), 0);
    const totalCapitalGain = dividends
      .filter((d: any) => d.income_type === '資本利得')
      .reduce((sum: number, d: any) => sum + (d.after_tax_amount || 0), 0);
    const totalTax = dividends.reduce((sum: number, d: any) => sum + (d.tax_amount || 0), 0);

    res.json({
      success: true,
      data: dividends,
      stats: {
        totalAfterTax,
        totalProfitLoss,
        totalDividend,
        totalCapitalGain,
        totalTax,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取歷史收益失敗',
    });
  }
});

// 取得 TWSE 除權除息原始資料（TWT49U），供前端顯示股票公告與除權除息資料
router.get('/exrights', async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, stockCode } = req.query;
    let query = 'SELECT * FROM twse_exrights WHERE 1 = 1';
    const params: any[] = [];

    if (startDate) {
      query += ' AND record_date >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND record_date <= ?';
      params.push(endDate);
    }
    if (stockCode) {
      query += ' AND stock_code LIKE ?';
      params.push(`%${stockCode}%`);
    }

    query += ' ORDER BY record_date DESC, stock_code ASC';

    const rows = await all<any>(query, params);

    res.json({
      success: true,
      data: rows,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '獲取除權除息原始資料失敗',
    });
  }
});

// 新增歷史收益記錄
router.post('/', async (req: AuthRequest, res) => {
  try {
    const {
      record_date,
      income_type = '全部',
      stock_code,
      stock_name,
      pre_tax_amount,
      tax_amount = 0,
      after_tax_amount,
      dividend_per_share,
      share_count,
      source,
      description,
    } = req.body;

    if (!record_date || !stock_code || !stock_name || !pre_tax_amount || !after_tax_amount) {
      return res.status(400).json({
        success: false,
        message: '請填寫所有必填欄位',
      });
    }

    const result = await run(
      'INSERT INTO dividends (user_id, record_date, income_type, stock_code, stock_name, pre_tax_amount, tax_amount, after_tax_amount, dividend_per_share, share_count, source, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [req.userId, record_date, income_type, stock_code, stock_name, pre_tax_amount, tax_amount, after_tax_amount, dividend_per_share || null, share_count || null, source || null, description || null]
    );
    const newDividendId = result.lastID;

    res.status(201).json({
      success: true,
      message: '歷史收益記錄新增成功',
      data: {
        id: newDividendId,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '新增歷史收益記錄失敗',
    });
  }
});

// 更新歷史收益記錄
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const {
      record_date,
      income_type,
      stock_code,
      stock_name,
      pre_tax_amount,
      tax_amount,
      after_tax_amount,
      dividend_per_share,
      share_count,
      source,
      description,
    } = req.body;

    const dividend: any = await get<any>(
      'SELECT * FROM dividends WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!dividend) {
      return res.status(404).json({
        success: false,
        message: '歷史收益記錄不存在',
      });
    }

    await run(
      'UPDATE dividends SET record_date = ?, income_type = ?, stock_code = ?, stock_name = ?, pre_tax_amount = ?, tax_amount = ?, after_tax_amount = ?, dividend_per_share = ?, share_count = ?, source = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [record_date, income_type, stock_code, stock_name, pre_tax_amount, tax_amount, after_tax_amount, dividend_per_share || null, share_count || null, source || null, description || null, id, req.userId]
    );

    res.json({
      success: true,
      message: '歷史收益記錄更新成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '更新歷史收益記錄失敗',
    });
  }
});

// 刪除歷史收益記錄
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const dividend: any = await get<any>(
      'SELECT * FROM dividends WHERE id = ? AND user_id = ?',
      [id, req.userId]
    );

    if (!dividend) {
      return res.status(404).json({
        success: false,
        message: '歷史收益記錄不存在',
      });
    }

    await run('DELETE FROM dividends WHERE id = ? AND user_id = ?', [id, req.userId]);

    res.json({
      success: true,
      message: '歷史收益記錄刪除成功',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: error.message || '刪除歷史收益記錄失敗',
    });
  }
});

export default router;


